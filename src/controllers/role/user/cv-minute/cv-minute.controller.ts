import express from 'express';
import isEmpty from '@/utils/isEmpty';

import { validationResult } from 'express-validator';
import { openai } from '@/socket';
import { PrismaClient } from '@/prisma/client';
import { extractJson } from '@/utils/functions';
import { SectionInterface } from '@/interfaces/role/user/cv-minute/section.interface';
import { CvMinuteSectionInterface } from '@/interfaces/role/user/cv-minute/cvMinuteSection.interface';
import { SectionInfoInterface } from '@/interfaces/role/user/cv-minute/sectionInfo.interface';
import { EvaluationInterface } from '@/interfaces/role/user/cv-minute/evaluation.interface';
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

    let section: SectionInterface | null = null;
    let cvMinuteSection: CvMinuteSectionInterface | null = null;
    let sectionInfo: SectionInfoInterface | null = null;

    const { id } = req.params;
    const body: {
      sectionOrder?: number;
      sectionTitle?: string;
      sectionInfoId?: number;

      icon?: string;
      iconSize?: number;
      role?: string;
      title?: string;
      content?: string;
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
        include: {
          sectionInfos: { include: { evaluation: true, advices: true } },
          advices: true,
        },
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

      // (update | create) sectionInfo
      if (body.sectionInfoId) {
        sectionInfo = await prisma.sectionInfo.update({
          where: { id: body.sectionInfoId },
          data: infosToUpdate,
        });
      } else {
        await prisma.sectionInfo.updateMany({
          where: { cvMinuteSectionId: body.cvMinuteSectionId },
          data: {
            order: {
              increment: 1,
            },
          },
        });

        sectionInfo = await prisma.sectionInfo.create({
          data: {
            ...infosToUpdate,
            cvMinuteSectionId: body.cvMinuteSectionId,
            order: 1,
          },
        });
      }
    } else if (body.newSection && body.title && body.content) {
      // create (section &| cvMinuteSection) & sectionInfo
      section = await prisma.section.findUnique({
        where: { name: body.title.trim().toLocaleLowerCase() },
      });

      if (section) {
        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: {
            cvMinuteId_sectionId: {
              cvMinuteId: cvMinute.id,
              sectionId: section.id,
            },
          },
        });

        if (cvMinuteSection) {
          res.json({ sectionAlreadyExist: true });
          return;
        } else {
          // create cvMinuteSection & sectionInfo
          cvMinuteSection = await prisma.cvMinuteSection.create({
            data: {
              cvMinuteId: cvMinute.id,
              sectionId: section.id,
              sectionTitle: body.title.trim(),
              sectionOrder: body.sectionOrder,
            },
          });

          sectionInfo = await prisma.sectionInfo.create({
            data: {
              cvMinuteSectionId: cvMinuteSection.id,
              content: body.content.trim(),
              order: 1,
            },
          });

          cvMinuteSection = await prisma.cvMinuteSection.findUnique({
            where: { id: cvMinuteSection.id },
            include: {
              sectionInfos: { include: { evaluation: true, advices: true } },
              advices: true,
            },
          });

          res.status(201).json({ cvMinuteSection });
          return;
        }
      } else {
        // create section & cvMinute & sectionInfo
        section = await prisma.section.create({
          data: {
            name: body.title.trim().toLocaleLowerCase(),
            editable: true,
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: cvMinute.id,
            sectionId: section.id,
            sectionTitle: body.title.trim(),
            sectionOrder: body.sectionOrder,
          },
        });

        sectionInfo = await prisma.sectionInfo.create({
          data: {
            cvMinuteSectionId: cvMinuteSection.id,
            content: body.content.trim(),
            order: 1,
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: {
            sectionInfos: { include: { evaluation: true, advices: true } },
            advices: true,
          },
        });

        res.status(201).json({ section, cvMinuteSection });
        return;
      }
    } else if (body.updateCvMinuteSection) {
      // update (cvMinuteSection &| sectionInfo)
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });

      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      } else {
        if (
          body.sectionTitle &&
          !isEmpty(body.sectionTitle) &&
          body.sectionTitle.trim() !== cvMinuteSection.sectionTitle
        ) {
          cvMinuteSection = await prisma.cvMinuteSection.update({
            where: { id: cvMinuteSection.id },
            data: { sectionTitle: body.sectionTitle.trim() },
          });
        }

        // (update | create) sectionInfo
        if (body.sectionInfoId) {
          sectionInfo = await prisma.sectionInfo.findUnique({
            where: { id: body.sectionInfoId },
          });

          if (sectionInfo && body.content !== sectionInfo.content) {
            sectionInfo = await prisma.sectionInfo.update({
              where: { id: body.sectionInfoId },
              data: { content: body.content?.trim() || ' ' },
            });
          }
        } else {
          await prisma.sectionInfo.updateMany({
            where: { cvMinuteSectionId: cvMinuteSection.id },
            data: {
              order: {
                increment: 1,
              },
            },
          });

          sectionInfo = await prisma.sectionInfo.create({
            data: {
              cvMinuteSectionId: cvMinuteSection.id,
              content: body.content?.trim() || ' ',
              order: 1,
            },
          });
        }

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: {
            sectionInfos: { include: { evaluation: true, advices: true } },
            advices: true,
          },
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
      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      }

      const infosToUpdate = {
        title: body.title.trim(),
        content: body.content.trim(),
        company: body.company.trim(),
        date: body.date.trim(),
        contrat: body.contrat.trim(),
      };

      if (body.sectionInfoId) {
        sectionInfo = await prisma.sectionInfo.update({
          where: { id: body.sectionInfoId },
          data: infosToUpdate,
        });

        if (!sectionInfo) {
          res.json({ sectionInfoNotFound: true });
          return;
        }
      } else {
        await prisma.sectionInfo.updateMany({
          where: { cvMinuteSectionId: cvMinuteSection.id },
          data: {
            order: {
              increment: 1,
            },
          },
        });

        sectionInfo = await prisma.sectionInfo.create({
          data: {
            ...infosToUpdate,
            order: 1,
            cvMinuteSectionId: cvMinuteSection.id,
          },
        });

        const details = `
          postTitle : ${sectionInfo.title}, 
          postDate : ${sectionInfo.date}, 
          postDescription : ${sectionInfo.content}, 
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
                sectionInfoId: sectionInfo.id,
                initialScore: Number(jsonData.postScore),
                content: jsonData.postHigh,
                weakContent: jsonData.postWeak,
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
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
        advices: true,
      },
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
      include: { advices: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map((c) => c.sectionId),
        },
        editable: true,
      },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find((s) => s.name === value);
      return cvMinuteSections.find((c) => c.sectionId === section?.id);
    };

    const allCvMinuteSections = sections
      .map((s) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        if (cvMinuteSection) {
          return cvMinuteSection.sectionTitle;
        }
        return null;
      })
      .filter((r) => r)
      .join(', ');

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
            Sections existantes :\n${allCvMinuteSections}\n
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
    const { sectionInfoId } = req.params;
    const body: { section: string } = req.body;

    let sectionInfo = await prisma.sectionInfo.findUnique({
      where: { id: Number(sectionInfoId) },
      include: { advices: true },
    });

    if (!sectionInfo) {
      res.json({ sectionInfoNotFound: true });
      return;
    }

    const advice = sectionInfo?.advices.find(
      (a) => a.type === 'advice',
    )?.content;

    if (body.section === 'title') {
      messageSystem = cvMinuteTitleAdvicePrompt.trim();

      messageUser = `
        Titre actuel :
        ${sectionInfo.content}\n
        Conseils : ${advice}\n
        Offre: ${cvMinute.position}
      `;
    } else if (body.section === 'presentation') {
      messageSystem = cvMinutePresentationAdvicePrompt.trim();

      messageUser = `
        Présentation actuelle : 
        ${sectionInfo.content}\n 
        Conseils :\n${advice} \n 
        Offre: ${cvMinute.position}
      `;
    } else if (body.section === 'experience') {
      messageSystem = cvMinuteExperienceAdvicePrompt.trim();

      messageUser = `
        Titre du poste: ${sectionInfo.title}\n 
        Description actuelle : ${sectionInfo.content}\n 
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
                sectionInfoId: sectionInfo?.id,
                content: item,
                type: 'suggestion',
              },
            });
          }),
        );
      }
    }

    sectionInfo = await prisma.sectionInfo.findUnique({
      where: { id: Number(sectionInfoId) },
      include: { advices: true },
    });
    res.status(200).json({ sectionInfo });
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
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
        advices: true,
      },
    });

    const sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map((c) => c.sectionId),
        },
      },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find((s) => s.name === value);
      return cvMinuteSections.find((c) => c.sectionId === section?.id);
    };

    const title = getCvMinuteSection('title');
    const presentation = getCvMinuteSection('presentation');
    const experiences = getCvMinuteSection('experiences');
    const editableSections = sections.filter((s) => s.editable);
    const allCvMinuteSections = editableSections
      .map((s) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        if (cvMinuteSection) {
          return `${cvMinuteSection.sectionTitle}: ${cvMinuteSection.sectionInfos[0].content}`;
        }
        return null;
      })
      .filter((r) => r)
      .join('\n');

    const cvDetails = `
      cvTitle : ${title?.sectionInfos[0].content}, 
      profilePresentation : ${presentation?.sectionInfos[0].content}, 
      experiences : ${experiences?.sectionInfos.map((item, index) => `${index}. poste : ${item.title}, contrat : ${item.contrat}, description : ${item.content}`).join('\n')}, 
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
    const { sectionInfoId } = req.params;

    let sectionInfo = await prisma.sectionInfo.findUnique({
      where: { id: Number(sectionInfoId) },
      include: { evaluation: true, advices: true },
    });

    if (!sectionInfo) {
      res.json({ sectionInfoNotFound: true });
      return;
    } else if (!sectionInfo.evaluation) {
      res.json({ evaluationNotFound: true });
      return;
    }

    const experience = `
      titre : ${sectionInfo.title}, 
      contrat : ${sectionInfo.contrat}, 
      description : ${sectionInfo.content}
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
          where: { id: sectionInfo.evaluation.id },
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
