import { Request, Response } from 'express';

import { htmlToText } from 'html-to-text';
import { PrismaClient } from '@prisma/client';
import { openai } from '@/socket';
import { CvMinuteSectionInterface } from '@/interfaces/role/user/cv-minute/cvMinuteSection.interface';
import { extractJson } from '@/utils/functions';
import { optimizeCvMinutePrompt } from '@/utils/prompts/cv-minute.prompt';

const prisma = new PrismaClient();

const optimizeCvMinute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: { include: { evaluation: true, advices: true } },
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

    const titleAdvice = title?.advices.find((a) => a.type === 'advice');
    const existTitle = `
      sectionInfoId : ${title?.id}, 
      adviceId : ${titleAdvice?.id}, 
      cvTitle : ${title?.content}, 
      advices : ${titleAdvice?.content}
    `;

    const presentationAdvice = presentation?.advices.find(
      (a) => a.type === 'advice',
    );
    const existPresentation = `
      sectionInfoId :${presentation?.id}, 
      adviceId : ${presentationAdvice?.id}, 
      profilePresentation : ${presentation?.content}, 
      advices : ${presentationAdvice?.content}
    `;

    const newSectionsAdvice = cvMinute.advices.find((a) => a.type === 'advice');
    const newSections = `
      adviceId : ${newSectionsAdvice?.id}, 
      newSectionsAdvice : ${newSectionsAdvice?.content}
    `;

    const existSections = editableSections
      .map((s) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        const cvMinuteSectionAdvice = cvMinuteSection?.advices.find(
          (a) =>
            a.cvMinuteSectionId === cvMinuteSection?.id && a.type === 'advice',
        );

        return `
          cvMinuteSectionId : ${cvMinuteSection?.id}, 
          adviceId : ${cvMinuteSectionAdvice?.id}, 
          sectionTitle : ${cvMinuteSection?.name}, 
          sectionContent : ${cvMinuteSection?.content}, 
          sectionAdvice : ${cvMinuteSectionAdvice?.content}
        `;
      })
      .join('\n');

    const existExperiences = experiences
      ?.map((item) => {
        return `
          sectionInfoId :${item.id},
          evaluationId : ${item.evaluation?.id}, 
          postTitle : ${item.title}, 
          postDate : ${item.date},
          postDescription : ${htmlToText(item.content)}, 
          postHigh : ${item.evaluation?.content},
          postWeak : ${item.evaluation?.weakContent}
        `;
      })
      .join('\n');

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: optimizeCvMinutePrompt.trim(),
        },
        {
          role: 'user',
          content: `
            Contenu du CV : ${existTitle}\n 
            Présentation : ${existPresentation}\n 
            Sections : ${existSections}\n 
            Expériences : ${existExperiences}\n 
            Nouvelles sections proposées : ${newSections}\n 
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
            request: 'optimize-cv',
            response: r.message.content ?? 'optimize-cv-response',
            index: r.index,
          },
        });

        const jsonData: {
          cvTitle: {
            sectionInfoId: string;
            adviceId: string;
            title: string;
            titleAdvice: string;
          };
          profilePresentation: {
            sectionInfoId: string;
            adviceId: string;
            presentation: string;
            presentationAdvice: string;
          };
          experiences: {
            sectionInfoId: string;
            evaluationId: string;
            postTitle: string;
            postDescription: string;
            postOrder: string;
            postScore: string;
            postHigh: string;
            postWeak: string;
          }[];
          sections: {
            cvMinuteSectionId: string;
            adviceId: string;
            sectionName: string;
            sectionContent: string;
            sectionOrder: string;
            sectionAdvice: string;
          }[];
          newSectionsAdvice: string;
          evaluations: {
            globalScore: string;
            recommendations: string;
          };
        } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        const allSections: {
          name: string;
          title?: string;
          order?: string;
          editable?: boolean;
          advice?: string;
          adviceId?: string;
          cvMinuteSectionId?: string;
          content?:
            | string
            | {
                sectionInfoId: string;
                evaluationId: string;
                title: string;
                content: string;
                order: string;
                score: string;
                high: string;
                weak: string;
              }[];
          withAdvice?: {
            sectionInfoId: string;
            adviceId: string;
            content: string;
            advice: string;
          };
        }[] = [
          {
            name: 'title',
            withAdvice: {
              sectionInfoId: jsonData.cvTitle.sectionInfoId,
              adviceId: jsonData.cvTitle.adviceId,
              content: jsonData.cvTitle.title,
              advice: jsonData.cvTitle.titleAdvice,
            },
          },
          {
            name: 'presentation',
            withAdvice: {
              sectionInfoId: jsonData.profilePresentation.sectionInfoId,
              adviceId: jsonData.profilePresentation.adviceId,
              content: jsonData.profilePresentation.presentation,
              advice: jsonData.profilePresentation.presentationAdvice,
            },
          },
          {
            name: 'experiences',
            content: jsonData.experiences.map(
              (item: {
                sectionInfoId: string;
                evaluationId: string;
                postTitle: string;
                postDescription: string;
                postOrder: string;
                postScore: string;
                postHigh: string;
                postWeak: string;
              }) => ({
                sectionInfoId: item.sectionInfoId,
                evaluationId: item.evaluationId,
                title: item.postTitle,
                content: item.postDescription,
                order: item.postOrder,
                score: item.postScore,
                high: item.postHigh,
                weak: item.postWeak,
              }),
            ),
          },
          ...jsonData.sections.map(
            (section: {
              cvMinuteSectionId: string;
              adviceId: string;
              sectionName: string;
              sectionContent: string;
              sectionOrder: string;
              sectionAdvice: string;
            }) => ({
              cvMinuteSectionId: section.cvMinuteSectionId,
              adviceId: section.adviceId,
              name: section.sectionName.trim().toLocaleLowerCase(),
              content: section.sectionContent.trim(),
              order: section.sectionOrder,
              advice: section.sectionAdvice,
              editable: true,
            }),
          ),
        ];

        // CVMINUTE SECTION
        await Promise.all(
          allSections.map(async (s) => {
            if (cvMinute) {
              let cvMinuteSection: CvMinuteSectionInterface | null = null;

              if (s.cvMinuteSectionId === 'new') {
                if (typeof s.content === 'string') {
                  cvMinuteSection = await prisma.cvMinuteSection.create({
                    data: {
                      name: s.name.trim(),
                      order: s.order ? Number(s.order) : 1,
                      content: s.content,
                      cvMinuteId: cvMinute.id,
                    },
                  });

                  await prisma.advice.create({
                    data: {
                      type: 'advice',
                      content: s.advice ?? '',
                      cvMinuteSectionId: cvMinuteSection.id,
                    },
                  });
                }
              } else if (s.cvMinuteSectionId) {
                cvMinuteSection = await prisma.cvMinuteSection.update({
                  where: { id: Number(s.cvMinuteSectionId) },
                  data: { name: s.name.trim() },
                });

                await prisma.advice.update({
                  where: { id: Number(s.adviceId) },
                  data: { content: s.advice },
                });
              }

              // SECTION INFO
              if (s.withAdvice) {
                await prisma.cvMinuteSection.update({
                  where: { id: Number(s.withAdvice.sectionInfoId) },
                  data: { content: s.withAdvice.content },
                });

                await prisma.advice.update({
                  where: { id: Number(s.withAdvice.adviceId) },
                  data: { content: s.withAdvice.advice },
                });
              } else {
                if (s.content && Array.isArray(s.content)) {
                  await Promise.all(
                    s.content.map(async (item) => {
                      if (typeof item === 'object') {
                        await prisma.cvMinuteSection.update({
                          where: { id: Number(item.sectionInfoId) },
                          data: {
                            content: item.content,
                            order: Number(item.order),
                          },
                        });

                        await prisma.evaluation.update({
                          where: { id: Number(item.evaluationId) },
                          data: {
                            actualScore: Number(item.score),
                            content: item.high,
                            weakContent: item.weak,
                          },
                        });
                      }
                    }),
                  );
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

        const cvMinuteAdvice = await prisma.advice.findFirst({
          where: { cvMinuteId: cvMinute.id, type: 'advice' },
        });

        if (cvMinuteAdvice) {
          await prisma.advice.update({
            where: { id: cvMinuteAdvice.id },
            data: { content: jsonData.newSectionsAdvice },
          });
        }
      }
    }

    cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: { include: { evaluation: true, advices: true } },
      },
    });

    res.status(200).json({ cvMinute });
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
