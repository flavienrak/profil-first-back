import express from 'express';
import isEmpty from '@/utils/isEmpty';

import { validationResult } from 'express-validator';
import { openai } from '@/socket';
import { PrismaClient } from '@prisma/client';
import { extractJson } from '@/utils/functions';
import { CvMinuteSectionInterface } from '@/interfaces/role/user/cv-minute/cvMinuteSection.interface';
import { EvaluationInterface } from '@/interfaces/evaluation.interface';
import {
  cvMinuteExperienceAdvicePrompt,
  cvMinutePresentationAdvicePrompt,
  cvMinuteTitleAdvicePrompt,
  cvMinuteEvaluationPrompt,
  experienceEvaluationPrompt,
  newCvMinuteSectionPrompt,
} from '@/utils/prompts/cv-minute.prompt';

const prisma = new PrismaClient();

const updateCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
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
      newSection?: boolean;
      updateExperience?: boolean;
      updateContactSection?: boolean;
      updateCvMinuteSection?: boolean;

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
          primaryBg: body.primaryBg.trim(),
          secondaryBg: body.secondaryBg.trim(),
          tertiaryBg: body.tertiaryBg.trim(),
        },
      });

      res.status(200).json({
        cvMinute: {
          primaryBg: updatedCvMinute.primaryBg,
          secondaryBg: updatedCvMinute.secondaryBg,
          tertiaryBg: updatedCvMinute.tertiaryBg,
        },
      });
      return;
    } else if (
      body.cvMinuteSectionId &&
      body.updateContactSection &&
      body.content &&
      body.icon
    ) {
      // (create | update) contact
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
        include: { evaluation: true, advices: true },
      });

      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      }

      const infosToUpdate = {
        content: body.content.trim(),
        icon: body.icon.trim(),
        iconSize: body.iconSize,
      };

      // (update | create) cvMinuteSection
      if (body.cvMinuteSectionId) {
        cvMinuteSection = await prisma.cvMinuteSection.update({
          where: { id: body.cvMinuteSectionId },
          data: infosToUpdate,
        });
      } else {
        await prisma.cvMinuteSection.updateMany({
          where: { cvMinuteId: cvMinute.id },
          data: { order: { increment: 1 } },
        });

        cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            ...infosToUpdate,
            name: 'contacts',
            order: 1,
            cvMinuteId: cvMinute.id,
          },
        });
      }
    } else if (body.newSection && body.title && body.content) {
      // create cvMinute & cvMinuteSection
      cvMinuteSection = await prisma.cvMinuteSection.create({
        data: {
          name: body.title.trim().toLocaleLowerCase(),
          order: body.order ?? 1,
          content: body.content.trim(),
          cvMinuteId: cvMinute.id,
        },
      });

      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: cvMinuteSection.id },
        include: { evaluation: true, advices: true },
      });

      res.status(201).json({ cvMinuteSection });
      return;
    } else if (body.updateCvMinuteSection) {
      // update (cvMinuteSection &| sectionInfo)
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });

      if (!cvMinuteSection) {
        // CREATE CVMINUTE SECTION
        await prisma.cvMinuteSection.updateMany({
          where: { cvMinuteId: cvMinute.id },
          data: { order: { increment: 1 } },
        });

        cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            order: 1,
            name: body.name?.trim() ?? '',
            content: body.content?.trim() || ' ',
            cvMinuteId: cvMinute.id,
          },
        });
      } else {
        cvMinuteSection = await prisma.cvMinuteSection.update({
          where: { id: cvMinuteSection.id },
          data: {
            name: body.name?.trim() ?? '',
            content: body.content?.trim() || ' ',
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: { evaluation: true, advices: true },
        });

        res.status(200).json({ cvMinuteSection });
        return;
      }
    } else if (
      body.updateExperience &&
      body.title &&
      body.content &&
      body.company &&
      body.date &&
      body.contrat
    ) {
      // (create | update) experience
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });

      const infosToUpdate = {
        title: body.title.trim(),
        content: body.content.trim(),
        company: body.company.trim(),
        date: body.date.trim(),
        contrat: body.contrat.trim(),
      };

      if (cvMinuteSection) {
        cvMinuteSection = await prisma.cvMinuteSection.update({
          where: { id: cvMinuteSection.id },
          data: infosToUpdate,
        });
      } else {
        await prisma.cvMinuteSection.updateMany({
          where: { cvMinuteId: cvMinute.id },
          data: { order: { increment: 1 } },
        });

        cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            ...infosToUpdate,
            order: 1,
            name: body.name?.trim() ?? '',
            cvMinuteId: cvMinute.id,
          },
        });

        const details = `
          postTitle : ${cvMinuteSection.title}, 
          postDate : ${cvMinuteSection.date}, 
          postDescription : ${cvMinuteSection.content}, 
        `;

        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: experienceEvaluationPrompt.trim(),
            },
            {
              role: 'user',
              content: `
                Expérience :\n${details}\n
                Offre :\n${cvMinute.position}
              `.trim(),
            },
          ],
        });

        if (openaiResponse.id) {
          for (const r of openaiResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiResponse.id,
                cvMinuteId: cvMinute.id,
                request: 'cv-minute-evaluation',
                response: r.message.content ?? 'cv-minute-evaluation-response',
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
                content: jsonData.postHigh,
                weakContent: jsonData.postWeak,
                cvMinuteSectionId: cvMinuteSection.id,
              },
            });
          }
        }
      }
    }

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
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

const generateCvMinuteSectionAdvice = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, cvMinuteSections: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const advice = cvMinute.advices.find((a) => a.type === 'advice');

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: newCvMinuteSectionPrompt.trim(),
        },
        {
          role: 'user',
          content: `
            Sections existantes :\n${cvMinute.cvMinuteSections.map((item) => item.name).join('\n')}\n
            Conseils :\n${advice?.content}\n
            Offre :\n${cvMinute.position}
          `.trim(),
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cv-minute-advice',
            response: r.message.content ?? 'cv-minute-advice-response',
            index: r.index,
          },
        });

        const jsonData: { sections: string[] } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        await Promise.all(
          jsonData.sections.map(async (s) => {
            await prisma.advice.create({
              data: {
                cvMinuteId: cvMinute.id,
                content: s,
                type: 'suggestion',
              },
            });
          }),
        );
      }
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

const generateSectionInfoAdvice = async (
  req: express.Request,
  res: express.Response,
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
    const body: { section: string } = req.body;

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(cvMinuteSectionId) },
      include: { advices: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    const advice = cvMinuteSection?.advices.find(
      (a) => a.type === 'advice',
    )?.content;

    if (body.section === 'title') {
      messageSystem = cvMinuteTitleAdvicePrompt.trim();

      messageUser = `
        Titre actuel :
        ${cvMinuteSection.content}\n
        Conseils : ${advice}\n
        Offre: ${cvMinute.position}
      `;
    } else if (body.section === 'presentation') {
      messageSystem = cvMinutePresentationAdvicePrompt.trim();

      messageUser = `
        Présentation actuelle : 
        ${cvMinuteSection.content}\n 
        Conseils :\n${advice} \n 
        Offre: ${cvMinute.position}
      `;
    } else if (body.section === 'experience') {
      messageSystem = cvMinuteExperienceAdvicePrompt.trim();

      messageUser = `
        Titre du poste: ${cvMinuteSection.title}\n 
        Description actuelle : ${cvMinuteSection.content}\n 
        Conseils : ${advice}\n 
        Offre: ${cvMinute.position}
      `;
    }

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: messageSystem.trim(),
        },
        {
          role: 'user',
          content: messageUser.trim(),
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cv-minute-advice',
            response: r.message.content ?? 'cv-minute-advice-response',
            index: r.index,
          },
        });

        const jsonData: { advices: string[] } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

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
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: { advices: true },
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
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let evaluation: EvaluationInterface | null = null;
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, evaluation: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    if (!cvMinute.evaluation) {
      res.json({ evaluationNotFound: true });
      return;
    }

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const getCvMinuteSection = (name: string) => {
      return cvMinuteSections.find((item) => item.name === name);
    };

    const title = getCvMinuteSection('title');
    const presentation = getCvMinuteSection('presentation');
    const experiences = cvMinuteSections.filter(
      (item) => item.name === 'experiences',
    );
    const editableSections = cvMinuteSections.filter((s) => s.editable);
    const allCvMinuteSections = editableSections
      .map((s) => `${s.name}: ${s.content}`)
      .filter((r) => r)
      .join('\n');

    const cvDetails = `
      cvTitle : ${title?.content}, 
      profilePresentation : ${presentation?.content}, 
      experiences : ${experiences?.map((item, index) => `${index}. poste : ${item.title}, contrat : ${item.contrat}, description : ${item.content}`).join('\n')}, 
      sections : ${allCvMinuteSections}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: cvMinuteEvaluationPrompt.trim(),
        },
        {
          role: 'user',
          content: `
            Contenu du CV : ${cvDetails}\n 
            Offre ciblée : ${cvMinute.position}
          `.trim(),
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cv-minute-matching-score',
            response: r.message.content ?? 'cv-minute-matching-score-response',
            index: r.index,
          },
        });

        const jsonData: { globalScore: string; recommendations: string } =
          extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        evaluation = await prisma.evaluation.update({
          where: { id: cvMinute.evaluation.id },
          data: {
            actualScore: Number(jsonData.globalScore),
            content: jsonData.recommendations,
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

const updateSectionInfoScore = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let evaluation: EvaluationInterface | null = null;
    const { cvMinute } = res.locals;
    const { cvMinuteSectionId } = req.params;

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(cvMinuteSectionId) },
      include: { evaluation: true, advices: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    } else if (!cvMinuteSection.evaluation) {
      res.json({ evaluationNotFound: true });
      return;
    }

    const experience = `
      titre : ${cvMinuteSection.title}, 
      contrat : ${cvMinuteSection.contrat}, 
      description : ${cvMinuteSection.content}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: experienceEvaluationPrompt.trim(),
        },
        {
          role: 'user',
          content: `
            Contenu de l'expérience : 
            ${experience}\n 
            Offre ciblée : ${cvMinute.position}
          `.trim(),
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cv-minute-matching-score',
            response: r.message.content ?? 'cv-minute-matching-score-response',
            index: r.index,
          },
        });

        const jsonData: {
          score: string;
          postHigh: string;
          postWeak: string;
        } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        evaluation = await prisma.evaluation.update({
          where: { id: cvMinuteSection.evaluation.id },
          data: {
            actualScore: Number(jsonData.score),
            content: jsonData.postHigh,
            weakContent: jsonData.postWeak,
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

export {
  updateCvMinuteSection,
  generateCvMinuteSectionAdvice,
  generateSectionInfoAdvice,
  updateCvMinuteScore,
  updateSectionInfoScore,
};
