import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { extractJson } from '@/utils/functions';
import { CvMinuteSectionInterface } from '@/interfaces/role/candidat/cv-minute/cvMinuteSection.interface';
import { EvaluationInterface } from '@/interfaces/evaluation.interface';
import {
  cvMinuteExperienceAdvicesPrompt,
  cvMinutePresentationAdvicesPrompt,
  cvMinuteTitleAdvicesPrompt,
  cvMinuteEvaluationPrompt,
  experienceEvaluationPrompt,
  newCvMinuteSectionPrompt,
  editableSectionEvaluationPrompt,
} from '@/utils/prompts/cv-minute.prompt';
import { gpt3 } from '@/utils/openai';
import { CvMinuteInterface } from '@/interfaces/role/candidat/cv-minute/cvMinute.interface';
import { PaymentInterface } from '@/interfaces/payment.interface';
import { inputToken, outputToken } from '@/utils/payment/token';
import { updateCvMinutePayments } from './updateCvMinutePayments';

const updateCvMinuteSection = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let cvMinuteSection: CvMinuteSectionInterface | null = null;

    const { id } = req.params;
    const {
      freeCard,
      premiumCards,
      boosterCards,

      totalCredits,
    } = res.locals as {
      freeCard: PaymentInterface;
      premiumCards: PaymentInterface[];
      boosterCards: PaymentInterface[];

      totalCredits: number;
    };
    const body: {
      name?: string;
      order?: number;
      title?: string;
      content?: string;
      icon?: string;
      iconSize?: number;
      role?: string;
      company?: string;
      date?: string;
      contrat?: string;
      primaryBg?: string;
      secondaryBg?: string;
      tertiaryBg?: string;

      updateBg?: boolean;
      updateName?: boolean;
      updateFirstname?: boolean;
      updateContact?: boolean;
      updateEditableSection?: boolean;
      updateTitle?: boolean;
      updatePresentation?: boolean;
      updateExperience?: boolean;

      newContact?: boolean;
      newEditableSection?: boolean;
      newExperience?: boolean;

      cvMinuteSectionId?: number;
    } = req.body;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, evaluation: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    if (
      body.updateBg &&
      body.primaryBg &&
      body.secondaryBg &&
      body.tertiaryBg
    ) {
      // update bg
      const updatedCvMinute = await prisma.cvMinute.update({
        where: { id: cvMinute.id },
        data: {
          primaryBg: body.primaryBg,
          secondaryBg: body.secondaryBg,
          tertiaryBg: body.tertiaryBg,
        },
      });

      res.status(200).json({
        cvMinute: {
          primaryBg: updatedCvMinute.primaryBg,
          secondaryBg: updatedCvMinute.secondaryBg,
          tertiaryBg: updatedCvMinute.tertiaryBg,
          updatedAt: updatedCvMinute.updatedAt,
        },
      });
      return;
    } else if (
      body.updateContact &&
      body.cvMinuteSectionId &&
      body.content &&
      body.icon &&
      body.iconSize
    ) {
      cvMinuteSection = await prisma.cvMinuteSection.update({
        where: { id: body.cvMinuteSectionId },
        data: {
          content: body.content,
          icon: body.icon,
          iconSize: body.iconSize,
        },
      });

      res.status(200).json({ cvMinuteSection });
      return;
    } else if (body.newContact && body.content && body.icon && body.iconSize) {
      await prisma.cvMinuteSection.updateMany({
        where: { cvMinuteId: cvMinute.id },
        data: { order: { increment: 1 } },
      });

      cvMinuteSection = await prisma.cvMinuteSection.create({
        data: {
          name: 'contacts',
          order: 1,
          content: body.content,
          icon: body.icon,
          iconSize: body.iconSize,
          cvMinuteId: cvMinute.id,
        },
      });

      res.status(200).json({ cvMinuteSection });
      return;
    } else if (body.newEditableSection && body.title && body.content) {
      const systemPrompt = editableSectionEvaluationPrompt.trim();
      const userPrompt = `
        Section: ${body.title} ${body.content}\n
        Offre: ${cvMinute.position}
      `.trim();

      let inputTokens = inputToken('gpt-3', systemPrompt + userPrompt);
      let outputTokens = outputToken('gpt-3', systemPrompt + userPrompt);
      let totalTokens = inputTokens + outputTokens;

      if (totalCredits < totalTokens) {
        res.json({ notAvailable: true });
        return;
      }

      await prisma.cvMinuteSection.updateMany({
        where: { cvMinuteId: cvMinute.id, editable: true },
        data: { order: { increment: 1 } },
      });

      cvMinuteSection = await prisma.cvMinuteSection.create({
        data: {
          name: body.title,
          order: 1,
          editable: true,
          content: body.content,
          cvMinuteId: cvMinute.id,
        },
      });

      const openaiResponse = await gpt3([
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      if ('error' in openaiResponse) {
        res.json({ openaiError: openaiResponse.error });
        return;
      }

      const responseChoice = openaiResponse.choices[0];

      if (responseChoice.message.content) {
        outputTokens = outputToken('gpt-3', responseChoice.message.content);

        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cvMinuteSectionAdvice',
            response: responseChoice.message.content,
            index: responseChoice.index,
          },
        });

        const jsonData: { content: string } = extractJson(
          responseChoice.message.content,
        );

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        await prisma.advice.create({
          data: {
            type: 'cvMinuteSectionAdvice',
            content: jsonData.content,
            cvMinuteSectionId: cvMinuteSection.id,
          },
        });
      }

      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: cvMinuteSection.id },
        include: { evaluation: true, advices: true },
      });

      totalTokens = inputTokens + outputTokens;

      await updateCvMinutePayments({
        totalTokens,
        freeCard,
        premiumCards,
        boosterCards,
      });

      const cardIds = [
        freeCard.id,
        ...premiumCards.map((item) => item.id),
        ...boosterCards.map((item) => item.id),
      ];

      const payments = await prisma.payment.findMany({
        where: { id: { in: cardIds } },
        include: { credit: true },
      });

      res.status(201).json({ cvMinuteSection, payments });
      return;
    } else if ((body.updateName || body.updateFirstname) && body.content) {
      cvMinuteSection = await prisma.cvMinuteSection.update({
        where: { id: body.cvMinuteSectionId },
        data: { content: body.content },
      });

      res.status(200).json({ cvMinuteSection });
      return;
    } else if ((body.updateTitle || body.updatePresentation) && body.content) {
      cvMinuteSection = await prisma.cvMinuteSection.update({
        where: { id: body.cvMinuteSectionId },
        data: { content: body.content || ' ' },
      });

      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: cvMinuteSection.id },
        include: { evaluation: true, advices: true },
      });

      res.status(200).json({ cvMinuteSection });
      return;
    } else if (body.updateEditableSection && body.name && body.content) {
      cvMinuteSection = await prisma.cvMinuteSection.update({
        where: { id: body.cvMinuteSectionId },
        data: { name: body.name, content: body.content },
      });

      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: cvMinuteSection.id },
        include: { advices: true },
      });

      res.status(200).json({ cvMinuteSection });
      return;
    } else if (body.updateExperience && body.cvMinuteSectionId) {
      const fields = [
        'title',
        'content',
        'company',
        'date',
        'contrat',
      ] as const;

      const infosToUpdate: Partial<Pick<typeof body, (typeof fields)[number]>> =
        {};

      fields.forEach((field) => {
        const value = body[field];
        if (typeof value === 'string' && value.trim().length > 0) {
          infosToUpdate[field] = value.trim();
        }
      });

      if (Object.keys(infosToUpdate).length > 0) {
        cvMinuteSection = await prisma.cvMinuteSection.update({
          where: { id: body.cvMinuteSectionId },
          data: infosToUpdate,
        });

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: { evaluation: true, advices: true },
        });

        res.status(200).json({ cvMinuteSection });
        return;
      }

      res.json({ noChanges: true });
      return;
    } else if (
      body.newExperience &&
      body.title &&
      body.content &&
      body.company &&
      body.date &&
      body.contrat
    ) {
      const details = `
      postTitle: ${body.title.trim()}, 
      postDate: ${body.date.trim()}, 
      postDescription: ${body.content.trim()}, 
    `;

      const systemPrompt = experienceEvaluationPrompt.trim();
      const userPrompt = `
      Expérience: ${details}\n
      Offre: ${cvMinute.position}
    `.trim();

      let inputTokens = inputToken('gpt-3', systemPrompt + userPrompt);
      let outputTokens = outputToken('gpt-3', systemPrompt + userPrompt);
      let totalTokens = inputTokens + outputTokens;

      if (totalCredits < totalTokens) {
        res.json({ notAvailable: true, cvMinuteSection });
        return;
      }

      await prisma.cvMinuteSection.updateMany({
        where: { name: 'experiences', cvMinuteId: cvMinute.id },
        data: { order: { increment: 1 } },
      });

      cvMinuteSection = await prisma.cvMinuteSection.create({
        data: {
          name: 'experiences',
          order: 1,
          title: body.title.trim(),
          content: body.content.trim(),
          company: body.company.trim(),
          date: body.date.trim(),
          contrat: body.contrat.trim(),
          cvMinuteId: cvMinute.id,
        },
      });

      const openaiResponse = await gpt3([
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      if ('error' in openaiResponse) {
        res.json({ openaiError: openaiResponse.error });
        return;
      }

      const responseChoice = openaiResponse.choices[0];

      if (responseChoice.message.content) {
        outputTokens = outputToken('gpt-3', responseChoice.message.content);

        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cvMinuteSectionEvaluation',
            response: responseChoice.message.content,
            index: responseChoice.index,
          },
        });

        const jsonData: {
          postScore: string;
          postHigh: string;
          postWeak: string;
        } = extractJson(responseChoice.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        await prisma.evaluation.create({
          data: {
            initialScore: Number(jsonData.postScore),
            actualScore: Number(jsonData.postScore),
            content: jsonData.postHigh,
            weakContent: jsonData.postWeak,
            cvMinuteSectionId: cvMinuteSection.id,
          },
        });
      }

      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: cvMinuteSection.id },
        include: { evaluation: true, advices: true },
      });

      totalTokens = inputTokens + outputTokens;

      await updateCvMinutePayments({
        totalTokens,
        freeCard,
        premiumCards,
        boosterCards,
      });

      const cardIds = [
        freeCard.id,
        ...premiumCards.map((item) => item.id),
        ...boosterCards.map((item) => item.id),
      ];

      const payments = await prisma.payment.findMany({
        where: { id: { in: cardIds } },
        include: { credit: true },
      });

      res.status(200).json({ cvMinuteSection, payments });
      return;
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

const generateNewCvMinuteSections = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      freeCard,
      premiumCards,
      boosterCards,

      totalCredits,
    } = res.locals as {
      freeCard: PaymentInterface;
      premiumCards: PaymentInterface[];
      boosterCards: PaymentInterface[];

      totalCredits: number;
    };

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        cvMinuteSections: { orderBy: { order: 'asc' } },
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const advice = cvMinute.advices.find((a) => a.type === 'cvMinuteAdvice');

    const systemPrompt = newCvMinuteSectionPrompt.trim();
    const userPrompt = `
      Sections existantes: ${cvMinute.cvMinuteSections.map((item) => item.name).join('\n')}\n
      Conseils: ${advice?.content}\n
      Offre ciblée: ${cvMinute.position}
    `.trim();

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    let inputTokens = inputToken('gpt-3', systemPrompt + userPrompt);
    let outputTokens = outputToken('gpt-3', systemPrompt + userPrompt);
    let totalTokens = inputTokens + outputTokens;

    if (totalCredits < totalTokens) {
      res.json({ notAvailable: true });
      return;
    }

    const responseChoice = openaiResponse.choices[0];

    if (responseChoice.message.content) {
      outputTokens = outputToken('gpt-3', responseChoice.message.content);

      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'newCvMinuteSectionSuggestion',
          response: responseChoice.message.content,
          index: responseChoice.index,
        },
      });

      const jsonData: { sections: string[] } = extractJson(
        responseChoice.message.content,
      );

      if (!jsonData) {
        res.json({ parsingError: true });
        return;
      }

      await prisma.advice.deleteMany({
        where: { cvMinuteId: cvMinute.id, type: 'suggestion' },
      });

      await Promise.all(
        jsonData.sections.map(async (s) => {
          await prisma.advice.create({
            data: {
              type: 'suggestion',
              content: s,
              cvMinuteId: cvMinute.id,
            },
          });
        }),
      );
    }

    const updatedCvMinute = await prisma.cvMinute.findUnique({
      where: { id: cvMinute.id },
      include: { advices: true },
    });

    totalTokens = inputTokens + outputTokens;

    await updateCvMinutePayments({
      totalTokens,
      freeCard,
      premiumCards,
      boosterCards,
    });

    const cardIds = [
      freeCard.id,
      ...premiumCards.map((item) => item.id),
      ...boosterCards.map((item) => item.id),
    ];

    const payments = await prisma.payment.findMany({
      where: { id: { in: cardIds } },
      include: { credit: true },
    });

    res.status(200).json({ cvMinute: updatedCvMinute, payments });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

const generateCvMinuteSectionAdvices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let systemPrompt = '';
    let userPrompt = '';
    const { cvMinuteSectionId } = req.params;
    const { cvMinute, freeCard, premiumCards, boosterCards, totalCredits } =
      res.locals as {
        cvMinute: CvMinuteInterface;

        freeCard: PaymentInterface;
        premiumCards: PaymentInterface[];
        boosterCards: PaymentInterface[];

        totalCredits: number;
      };

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(cvMinuteSectionId), cvMinuteId: cvMinute.id },
      include: { advices: true, evaluation: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    const advice = cvMinuteSection.advices.find(
      (a) => a.type === 'cvMinuteSectionAdvice',
    )?.content;

    if (cvMinuteSection.name === 'title') {
      systemPrompt = cvMinuteTitleAdvicesPrompt.trim();

      userPrompt = `
        Titre actuel:
        ${cvMinuteSection.content}\n
        Conseils: ${advice}\n
        Offre ciblée: ${cvMinute.position}
      `.trim();
    } else if (cvMinuteSection.name === 'presentation') {
      systemPrompt = cvMinutePresentationAdvicesPrompt.trim();

      userPrompt = `
        Présentation actuelle: 
        ${cvMinuteSection.content}\n 
        Conseils:\n${advice} \n 
        Offre ciblée: ${cvMinute.position}
      `.trim();
    } else if (cvMinuteSection.name === 'experiences') {
      systemPrompt = cvMinuteExperienceAdvicesPrompt.trim();

      userPrompt = `
        Titre du poste: ${cvMinuteSection.title}\n 
        Description actuelle: ${cvMinuteSection.content}\n 
        Conseils: ${advice}\n 
        Offre ciblée: ${cvMinute.position}
      `.trim();
    }

    let inputTokens = inputToken('gpt-3', systemPrompt + userPrompt);
    let outputTokens = outputToken('gpt-3', systemPrompt + userPrompt);
    let totalTokens = inputTokens + outputTokens;

    if (totalCredits < totalTokens) {
      res.json({ notAvailable: true });
      return;
    }

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    const responseChoice = openaiResponse.choices[0];

    if (responseChoice.message.content) {
      outputTokens = outputToken('gpt-3', responseChoice.message.content);

      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'cvMinuteSectionSuggestion',
          response: responseChoice.message.content,
          index: responseChoice.index,
        },
      });

      const jsonData: { advices: string[] } = extractJson(
        responseChoice.message.content,
      );

      if (!jsonData) {
        res.json({ parsingError: true });
        return;
      }

      await prisma.advice.deleteMany({
        where: { type: 'suggestion', cvMinuteSectionId: cvMinuteSection.id },
      });

      await Promise.all(
        jsonData.advices.map(async (item) => {
          await prisma.advice.create({
            data: {
              type: 'suggestion',
              content: item,
              cvMinuteSectionId: cvMinuteSection?.id,
            },
          });
        }),
      );
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: { advices: true, evaluation: true },
    });

    totalTokens = inputTokens + outputTokens;

    await updateCvMinutePayments({
      totalTokens,
      freeCard,
      premiumCards,
      boosterCards,
    });

    const cardIds = [
      freeCard.id,
      ...premiumCards.map((item) => item.id),
      ...boosterCards.map((item) => item.id),
    ];

    const payments = await prisma.payment.findMany({
      where: { id: { in: cardIds } },
      include: { credit: true },
    });

    res.status(200).json({ cvMinuteSection, payments });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

const updateCvMinuteScore = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    let evaluation: EvaluationInterface | null = null;
    const { id } = req.params;
    const {
      freeCard,
      premiumCards,
      boosterCards,

      totalCredits,
    } = res.locals as {
      freeCard: PaymentInterface;
      premiumCards: PaymentInterface[];
      boosterCards: PaymentInterface[];

      totalCredits: number;
    };

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        cvMinuteSections: { orderBy: { order: 'asc' } },
        advices: true,
        evaluation: true,
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    if (!cvMinute.evaluation) {
      res.json({ evaluationNotFound: true });
      return;
    }

    const getCvMinuteSection = (value: string) => {
      return cvMinute.cvMinuteSections.find((item) => item.name === value);
    };

    const title = getCvMinuteSection('title');
    const presentation = getCvMinuteSection('presentation');

    const experiences = cvMinute.cvMinuteSections.filter(
      (item) => item.name === 'experiences',
    );

    const editableSections = cvMinute.cvMinuteSections.filter(
      (s) => s.editable,
    );

    const allEditableSections = editableSections
      .map((s) => `${s.name}: ${s.content}`)
      .filter((r) => r)
      .join('\n');

    const cvDetails = `
      cvTitle: ${title?.content}, 
      profilePresentation: ${presentation?.content}, 
      experiences: ${experiences?.map((item, index) => `${index}. poste: ${item.title}, contrat: ${item.contrat}, description: ${item.content}`).join('\n')}, 
      sections: ${allEditableSections}
    `;

    const systemPrompt = cvMinuteEvaluationPrompt.trim();
    const userPrompt = `
      Contenu du CV: ${cvDetails}\n 
      Offre ciblée: ${cvMinute.position}
    `.trim();

    let inputTokens = inputToken('gpt-3', userPrompt + systemPrompt);
    let outputTokens = outputToken('gpt-3', userPrompt + systemPrompt);
    let totalTokens = inputTokens + outputTokens;

    if (totalCredits < totalTokens) {
      res.json({ notAvailable: true });
      return;
    }

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    const responseChoice = openaiResponse.choices[0];

    if (responseChoice.message.content) {
      outputTokens = outputToken('gpt-3', responseChoice.message.content);

      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'cvMinuteMatchingScore',
          response: responseChoice.message.content ?? '',
          index: responseChoice.index,
        },
      });

      const jsonData: { globalScore: string; recommendations: string } =
        extractJson(responseChoice.message.content);

      if (!jsonData) {
        res.json({ parsingError: true });
        return;
      }

      if (cvMinute.evaluation) {
        evaluation = await prisma.evaluation.update({
          where: { id: cvMinute.evaluation.id },
          data: {
            actualScore: Number(jsonData.globalScore),
            content: jsonData.recommendations,
          },
        });
      } else {
        evaluation = await prisma.evaluation.create({
          data: {
            initialScore: Number(jsonData.globalScore),
            actualScore: Number(jsonData.globalScore),
            content: jsonData.recommendations,
            cvMinuteId: cvMinute.id,
          },
        });
      }
    }

    totalTokens = inputTokens + outputTokens;

    await updateCvMinutePayments({
      totalTokens,
      freeCard,
      premiumCards,
      boosterCards,
    });

    const cardIds = [
      freeCard.id,
      ...premiumCards.map((item) => item.id),
      ...boosterCards.map((item) => item.id),
    ];

    const payments = await prisma.payment.findMany({
      where: { id: { in: cardIds } },
      include: { credit: true },
    });

    res.status(200).json({ evaluation, payments });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

const updateCvMinuteSectionScore = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      cvMinute,

      freeCard,
      premiumCards,
      boosterCards,

      totalCredits,
    } = res.locals as {
      cvMinute: CvMinuteInterface;

      freeCard: PaymentInterface;
      premiumCards: PaymentInterface[];
      boosterCards: PaymentInterface[];

      totalCredits: number;
    };
    const { cvMinuteSectionId } = req.params;

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(cvMinuteSectionId) },
      include: { evaluation: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    const experience = `
      titre: ${cvMinuteSection.title}, 
      contrat: ${cvMinuteSection.contrat}, 
      description: ${cvMinuteSection.content}
    `;

    const systemPrompt = experienceEvaluationPrompt.trim();
    const userPrompt = `
      Contenu de l'expérience: 
      ${experience}\n 
      Offre ciblée: ${cvMinute.position}
    `.trim();

    let inputTokens = inputToken('gpt-3', systemPrompt + userPrompt);
    let outputTokens = outputToken('gpt-3', systemPrompt + userPrompt);
    let totalTokens = inputTokens + outputTokens;

    if (totalCredits < totalTokens) {
      res.json({ notAvailable: true });
      return;
    }

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    const responseChoice = openaiResponse.choices[0];

    if (responseChoice.message.content) {
      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'cvMinuteSectionMatchingScore',
          response: responseChoice.message.content ?? '',
          index: responseChoice.index,
        },
      });

      const jsonData: {
        postScore: string;
        postHigh: string;
        postWeak: string;
      } = extractJson(responseChoice.message.content);

      if (!jsonData) {
        res.json({ parsingError: true });
        return;
      }

      if (!cvMinuteSection.evaluation) {
        await prisma.evaluation.create({
          data: {
            initialScore: Number(jsonData.postScore),
            actualScore: Number(jsonData.postScore),
            content: jsonData.postHigh,
            weakContent: jsonData.postWeak,
            cvMinuteSectionId: cvMinuteSection.id,
          },
        });
      } else {
        await prisma.evaluation.update({
          where: { id: cvMinuteSection.evaluation.id },
          data: {
            actualScore: Number(jsonData.postScore),
            content: jsonData.postHigh,
            weakContent: jsonData.postWeak,
          },
        });
      }
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: { evaluation: true, advices: true },
    });

    totalTokens = inputTokens + outputTokens;

    await updateCvMinutePayments({
      totalTokens,
      freeCard,
      premiumCards,
      boosterCards,
    });

    const cardIds = [
      freeCard.id,
      ...premiumCards.map((item) => item.id),
      ...boosterCards.map((item) => item.id),
    ];

    const payments = await prisma.payment.findMany({
      where: { id: { in: cardIds } },
      include: { credit: true },
    });

    res.status(200).json({ cvMinuteSection, payments });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

export {
  updateCvMinuteSection,
  generateNewCvMinuteSections,
  generateCvMinuteSectionAdvices,
  updateCvMinuteScore,
  updateCvMinuteSectionScore,
};
