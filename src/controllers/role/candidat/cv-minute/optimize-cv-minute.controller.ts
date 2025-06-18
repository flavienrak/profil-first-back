import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { htmlToText } from 'html-to-text';
import { extractJson, formatTextWithStrong } from '@/utils/functions';
import { optimizeCvMinutePrompt } from '@/utils/prompts/cv-minute.prompt';
import { gpt4 } from '@/utils/openai';
import { PaymentInterface } from '@/interfaces/payment.interface';
import { inputToken, outputToken } from '@/utils/payment/token';
import { updateCvMinutePayments } from './updateCvMinutePayments';

const optimizeCvMinute = async (req: Request, res: Response): Promise<void> => {
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

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: {
          include: { evaluation: true, advices: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const getCvMinuteSection = (name: string) => {
      return cvMinute?.cvMinuteSections.find((item) => item.name === name);
    };

    const title = getCvMinuteSection('title');
    const presentation = getCvMinuteSection('presentation');

    const experiences = cvMinute.cvMinuteSections.filter(
      (item) => item.name === 'experiences',
    );

    const editableSections = cvMinute.cvMinuteSections.filter(
      (item) => item.editable,
    );

    const titleAdvice = title?.advices.find(
      (item) => item.type === 'cvMinuteSectionAdvice',
    );
    const existTitle = `
      sectionId: ${title?.id}, 
      cvTitle: ${title?.content}, 
      titleAdvice: ${titleAdvice?.content}
    `;

    const presentationAdvice = presentation?.advices.find(
      (item) => item.type === 'cvMinuteSectionAdvice',
    );
    const existPresentation = `
      sectionId:${presentation?.id}, 
      profilePresentation: ${presentation?.content}, 
      presentationAdvice: ${presentationAdvice?.content}
    `;

    const newSectionsAdvice = cvMinute.advices.find(
      (item) => item.type === 'cvMinuteSectionAdvice',
    );
    const newSections = `
      adviceId: ${newSectionsAdvice?.id}, 
      newSectionsAdvice: ${newSectionsAdvice?.content}
    `;

    const existSections = editableSections
      .map((item) => {
        return `
          sectionId: ${item.id}, 
          sectionTitle: ${item.name}, 
          sectionContent: ${item.content}, 
          sectionAdvice: ${item.content}
        `;
      })
      .join('\n');

    const existExperiences = experiences
      ?.map((item) => {
        return `
          sectionId:${item.id},
          postDescription: ${htmlToText(item.content)}, 
          postHigh: ${item.evaluation?.content},
          postWeak: ${item.evaluation?.weakContent}
        `;
      })
      .join('\n');

    const systemPrompt = optimizeCvMinutePrompt.trim();
    const userPrompt = `
      Contenu du CV:\n
      Titre: ${existTitle}\n 
      Présentation: ${existPresentation}\n 
      Sections: ${existSections}\n 
      Expériences: ${existExperiences}\n 
      Nouvelles sections proposées: ${newSections}\n 
      Offre ciblée: ${cvMinute.position}
    `.trim();

    let inputTokens = inputToken('gpt-4', systemPrompt + userPrompt);
    let outputTokens = outputToken('gpt-4', systemPrompt + userPrompt);
    let totalTokens = inputTokens + outputTokens;

    if (totalCredits < totalTokens) {
      res.json({ notAvailable: true });
      return;
    }

    const openaiResponse = await gpt4([
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
      outputTokens = outputToken('gpt-4', responseChoice.message.content);

      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          cvMinuteId: cvMinute.id,
          request: 'optimizeCvMiute',
          response: responseChoice.message.content ?? '',
          index: responseChoice.index,
        },
      });

      const jsonData: {
        cvTitle: {
          sectionId: string;
          title: string;
        };
        profilePresentation: {
          sectionId: string;
          presentation: string;
        };
        experiences: {
          sectionId: string;
          postDescription: string;
          postOrder: string;
          postScore: string;
          postHigh: string;
          postWeak: string;
        }[];
        sections: {
          sectionId: string;
          sectionName: string;
          sectionContent: string;
          sectionOrder: string;
        }[];
        evaluations: {
          globalScore: string;
          recommendations: string;
        };
      } = extractJson(responseChoice.message.content);

      if (!jsonData) {
        res.json({ parsingError: true });
        return;
      }

      const allSections: {
        name: string;
        sectionId?: string;
        content?:
          | string
          | {
              sectionId: string;
              content: string;
              order: string;
              postScore: string;
              postHigh: string;
              postWeak: string;
            }[];
      }[] = [
        {
          name: 'title',
          sectionId: jsonData.cvTitle.sectionId,
          content: jsonData.cvTitle.title,
        },
        {
          name: 'presentation',
          sectionId: jsonData.profilePresentation.sectionId,
          content: jsonData.profilePresentation.presentation,
        },
        {
          name: 'experiences',
          content: jsonData.experiences.map(
            (item: {
              sectionId: string;
              postDescription: string;
              postOrder: string;
              postScore: string;
              postHigh: string;
              postWeak: string;
            }) => ({
              sectionId: item.sectionId,
              content: item.postDescription,
              order: item.postOrder,
              postScore: item.postScore,
              postHigh: item.postHigh,
              postWeak: item.postWeak,
            }),
          ),
        },
        ...jsonData.sections.map((section) => ({
          sectionId: section.sectionId,
          name: section.sectionName.trim().toLocaleLowerCase(),
          content: section.sectionContent.trim(),
        })),
      ];

      // CVMINUTE SECTIONS
      await Promise.all(
        allSections.map(async (s) => {
          if (cvMinute) {
            if (s.sectionId === 'new') {
              if (typeof s.content === 'string') {
                await prisma.cvMinuteSection.updateMany({
                  where: { cvMinuteId: cvMinute.id, editable: true },
                  data: { order: { increment: 1 } },
                });

                await prisma.cvMinuteSection.create({
                  data: {
                    name: s.name.trim(),
                    order: 1,
                    content: s.content.trim(),
                    cvMinuteId: cvMinute.id,
                  },
                });
              }
            } else {
              if (Array.isArray(s.content)) {
                await Promise.all(
                  s.content.map(async (item) => {
                    const cvMinuteSection = await prisma.cvMinuteSection.update(
                      {
                        where: { id: Number(item.sectionId) },
                        data: {
                          content: formatTextWithStrong(item.content),
                          order: Number(item.order),
                        },
                      },
                    );

                    const evaluation = await prisma.evaluation.findUnique({
                      where: { cvMinuteSectionId: cvMinuteSection.id },
                    });

                    if (evaluation) {
                      await prisma.evaluation.update({
                        where: { id: evaluation.id },
                        data: {
                          actualScore: Number(item.postScore),
                          content: item.postHigh,
                          weakContent: item.postWeak,
                        },
                      });
                    } else {
                      await prisma.evaluation.create({
                        data: {
                          initialScore: Number(item.postScore),
                          actualScore: Number(item.postScore),
                          content: item.postHigh,
                          weakContent: item.postWeak,
                          cvMinuteSectionId: cvMinuteSection.id,
                        },
                      });
                    }
                  }),
                );
              } else {
                await prisma.cvMinuteSection.update({
                  where: { id: Number(s.sectionId) },
                  data: { name: s.name, content: s.content },
                });
              }
            }
          }
        }),
      );

      await prisma.evaluation.update({
        where: { cvMinuteId: cvMinute.id },
        data: {
          actualScore: Number(jsonData.evaluations.globalScore),
          content: jsonData.evaluations.recommendations,
        },
      });
    }

    cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        files: true,
        evaluation: true,
        cvMinuteSections: {
          include: { evaluation: true, advices: true, files: true },
          orderBy: { order: 'asc' },
        },
      },
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

    res.status(200).json({ cvMinute, payments });
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

export { optimizeCvMinute };
