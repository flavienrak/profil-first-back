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

      const details = `${cvMinuteSection.name} ${cvMinuteSection.content}`;

      const openaiResponse = await gpt3([
        {
          role: 'system',
          content: editableSectionEvaluationPrompt.trim(),
        },
        {
          role: 'user',
          content: `
            Section:\n${details}\n
            Offre:\n${cvMinute.position}
          `.trim(),
        },
      ]);

      if ('error' in openaiResponse) {
        res.json({ openaiError: openaiResponse.error });
        return;
      }

      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cvMinuteSectionAdvice',
            response: r.message.content ?? '',
            index: r.index,
          },
        });

        const jsonData: { content: string } = extractJson(r.message.content);

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

      res.status(201).json({ cvMinuteSection });
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

      const details = `
        postTitle: ${cvMinuteSection.title}, 
        postDate: ${cvMinuteSection.date}, 
        postDescription: ${cvMinuteSection.content}, 
      `;

      const openaiResponse = await gpt3([
        {
          role: 'system',
          content: experienceEvaluationPrompt.trim(),
        },
        {
          role: 'user',
          content: `
            Expérience:\n${details}\n
            Offre:\n${cvMinute.position}
          `.trim(),
        },
      ]);

      if ('error' in openaiResponse) {
        res.json({ openaiError: openaiResponse.error });
        return;
      }

      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cvMinuteSectionEvaluation',
            response: r.message.content ?? '',
            index: r.index,
          },
        });

        const jsonData: {
          postScore: string;
          postHigh: string;
          postWeak: string;
        } = extractJson(r.message.content);

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

      res.status(200).json({ cvMinuteSection });
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

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: newCvMinuteSectionPrompt.trim(),
      },
      {
        role: 'user',
        content: `
          Sections existantes: ${cvMinute.cvMinuteSections.map((item) => item.name).join('\n')}\n
          Conseils: ${advice?.content}\n
          Offre ciblée: ${cvMinute.position}
        `.trim(),
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    for (const r of openaiResponse.choices) {
      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'newCvMinuteSectionSuggestion',
          response: r.message.content ?? '',
          index: r.index,
        },
      });

      const jsonData: { sections: string[] } = extractJson(r.message.content);

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
    res.status(200).json({ cvMinute: updatedCvMinute });
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

    let messageSystem = '';
    let messageUser = '';
    const { cvMinute } = res.locals;
    const { cvMinuteSectionId } = req.params;

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
      messageSystem = cvMinuteTitleAdvicesPrompt.trim();

      messageUser = `
        Titre actuel:
        ${cvMinuteSection.content}\n
        Conseils: ${advice}\n
        Offre ciblée: ${cvMinute.position}
      `;
    } else if (cvMinuteSection.name === 'presentation') {
      messageSystem = cvMinutePresentationAdvicesPrompt.trim();

      messageUser = `
        Présentation actuelle: 
        ${cvMinuteSection.content}\n 
        Conseils:\n${advice} \n 
        Offre ciblée: ${cvMinute.position}
      `;
    } else if (cvMinuteSection.name === 'experiences') {
      messageSystem = cvMinuteExperienceAdvicesPrompt.trim();

      messageUser = `
        Titre du poste: ${cvMinuteSection.title}\n 
        Description actuelle: ${cvMinuteSection.content}\n 
        Conseils: ${advice}\n 
        Offre ciblée: ${cvMinute.position}
      `;
    }

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: messageSystem.trim(),
      },
      {
        role: 'user',
        content: messageUser.trim(),
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    for (const r of openaiResponse.choices) {
      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'cvMinuteSectionSuggestion',
          response: r.message.content ?? '',
          index: r.index,
        },
      });

      const jsonData: { advices: string[] } = extractJson(r.message.content);

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

    res.status(200).json({ cvMinuteSection });
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

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: cvMinuteEvaluationPrompt.trim(),
      },
      {
        role: 'user',
        content: `
          Contenu du CV: ${cvDetails}\n 
          Offre ciblée: ${cvMinute.position}
        `.trim(),
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    for (const r of openaiResponse.choices) {
      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'cvMinuteMatchingScore',
          response: r.message.content ?? '',
          index: r.index,
        },
      });

      const jsonData: { globalScore: string; recommendations: string } =
        extractJson(r.message.content);

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

    res.status(200).json({ evaluation });
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
    const { cvMinute } = res.locals;
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

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: experienceEvaluationPrompt.trim(),
      },
      {
        role: 'user',
        content: `
          Contenu de l'expérience: 
          ${experience}\n 
          Offre ciblée: ${cvMinute.position}
        `.trim(),
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    for (const r of openaiResponse.choices) {
      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'cvMinuteSectionMatchingScore',
          response: r.message.content ?? '',
          index: r.index,
        },
      });

      const jsonData: {
        postScore: string;
        postHigh: string;
        postWeak: string;
      } = extractJson(r.message.content);

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

    res.status(200).json({ cvMinuteSection });
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
