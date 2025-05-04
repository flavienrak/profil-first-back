import { Request, Response } from 'express';

import { htmlToText } from 'html-to-text';
import { PrismaClient } from '@prisma/client';
import { openai } from '../../../../socket';
import { CvMinuteSectionInterface } from '../../../../interfaces/role/user/cv-minute/cvMinuteSection.interface';
import { extractJson } from '../../../../utils/functions';

const prisma = new PrismaClient();

const optimizeCvMinute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: {
          include: {
            sectionInfos: { include: { evaluation: true, advices: true } },
            advices: true,
          },
        },
      },
    });

    let sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinute.cvMinuteSections.map(
            (c: CvMinuteSectionInterface) => c.sectionId,
          ),
        },
      },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find((s) => s.name === value);
      return cvMinute.cvMinuteSections.find((c) => c.sectionId === section?.id);
    };

    const title = getCvMinuteSection('title');
    const presentation = getCvMinuteSection('presentation');
    const experiences = getCvMinuteSection('experiences');
    const editableSections = sections.filter((s) => s.editable);

    const titleAdvice = title?.sectionInfos[0].advices.find(
      (a) => a.type === 'advice',
    );
    const existTitle = `
      sectionInfoId : ${title?.sectionInfos[0]?.id}, 
      adviceId : ${titleAdvice?.id}, 
      cvTitle : ${title?.sectionInfos[0]?.content}, 
      advices : ${titleAdvice?.content}
    `;

    const presentationAdvice = presentation?.sectionInfos[0].advices.find(
      (a) => a.type === 'advice',
    );
    const existPresentation = `
      sectionInfoId :${presentation?.sectionInfos[0]?.id}, 
      adviceId : ${presentationAdvice.id}, 
      profilePresentation : ${presentation?.sectionInfos[0]?.content}, 
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
        const cvMinuteSectionAdvice = cvMinuteSection.advices.find(
          (a) =>
            a.cvMinuteSectionId === cvMinuteSection.id && a.type === 'advice',
        );

        return `
          cvMinuteSectionId : ${cvMinuteSection?.id}, 
          adviceId : ${cvMinuteSectionAdvice?.id}, 
          sectionTitle : ${cvMinuteSection.sectionTitle}, 
          sectionContent : ${cvMinuteSection?.sectionInfos[0]?.content}, 
          sectionAdvice : ${cvMinuteSectionAdvice?.content}
        `;
      })
      .join('\n');

    const existExperiences = experiences.sectionInfos
      .map((item) => {
        return `
          sectionInfoId :${item.id},
          evaluationId : ${item.evaluation.id}, 
          postTitle : ${item.title}, 
          postDate : ${item.date},
          postDescription : ${htmlToText(item.content)}, 
          postHigh : ${item.evaluation.content},
          postWeak : ${item.evaluation.weakContent}
        `;
      })
      .join('\n');

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `
            Objectif :
            Tu es expert en rédaction et optimisation de CV. Selon une offre d'emploi et des conseils, optimise tout le contenu du CV en respectant les contraintes suivantes :

            Contraintes générales :
            - Aucun contenu ne doit être perdu (sortie >= entrée).
            - Optimiser chaque contenu pour maximiser la compatibilité avec l'offre.
            - Ne modifie pas les sections suivantes : "formations", "centres d'intérêt", "certifications", "diplômes" (renvoie-les telles quelles).
            - Génère de nouvelles sections appelées "rubriques" selon les conseils.
            - Scores : entre 0 et 100.

            Format de retour attendu (JSON uniquement) :
            {
              cvTitle: {
                sectionInfoId: (identique à l’entrée),
                adviceId: (identique à l’entrée),
                title: string,
                titleAdvice: string // 1 à 3 phrases, une par ligne
              },
              profilePresentation: {
                sectionInfoId: (identique à l’entrée),
                adviceId: (identique à l’entrée),
                presentation: string,
                presentationAdvice: string // 1 à 3 phrases, une par ligne
              },
              experiences: [
                {
                  sectionInfoId: (identique à l’entrée),
                  evaluationId: (identique à l’entrée),
                  postTitle: (identique à l’entrée),
                  postDescription: string, // très explicite
                  postDate: (identique à l’entrée),
                  postOrder: string, // "1" = plus récent
                  postScore: string, // 0 à 100
                  postHigh: string, // 1 à 3 phrases, une par ligne
                  postWeak: string  // 1 à 3 phrases, une par ligne
                }
              ],
              sections: [
                {
                  cvMinuteSectionId: (identique ou "new" si générée),
                  adviceId: (identique ou "new" si générée),
                  sectionTitle: string,
                  sectionContent: string, // contenu à la ligne, explicite
                  sectionOrder: string, // "1", "2", ...
                  sectionAdvice: string // 1 à 3 phrases, une par ligne
                }
              ],
              newSectionsAdvice: string // 1 à 3 phrases, une par ligne
              evaluations: {
                globalScore: string, // 0 à 100
                recommendations: string // 1 à 3 phrases, une par ligne
              }
            }

            Ne jamais inclure d’introduction ou d’explication. Seulement du JSON.
          `.trim(),
        },
        {
          role: 'user',
          content: `
            Contenu du CV : ${existTitle}\n 
            Présentation : ${existPresentation}\n 
            Sections : ${existSections}\n 
            Expériences : ${existExperiences}\n 
            Nouvelles sections proposées : ${newSections}\n 
            Offre : ${cvMinute.position}
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
            response: r.message.content,
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
            sectionTitle: string;
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
              sectionTitle: string;
              sectionContent: string;
              sectionOrder: string;
              sectionAdvice: string;
            }) => ({
              cvMinuteSectionId: section.cvMinuteSectionId,
              adviceId: section.adviceId,
              name: section.sectionTitle.trim().toLocaleLowerCase(),
              title: section.sectionTitle.trim().toLocaleLowerCase(),
              content: section.sectionContent.trim(),
              order: section.sectionOrder,
              advice: section.sectionAdvice,
              editable: true,
            }),
          ),
        ];

        // CvMinuteSection
        for (const s of allSections) {
          let section = null;
          let cvMinuteSection = null;

          if (s.cvMinuteSectionId === 'new') {
            section = await prisma.section.findUnique({
              where: { name: s.name.trim().toLowerCase() },
            });

            if (!section) {
              section = await prisma.section.create({
                data: {
                  name: s.name.trim().toLowerCase(),
                  editable: s.editable,
                },
              });
            }

            cvMinuteSection = await prisma.cvMinuteSection.findUnique({
              where: {
                cvMinuteId_sectionId: {
                  cvMinuteId: cvMinute.id,
                  sectionId: section.id,
                },
              },
            });

            if (!cvMinuteSection) {
              cvMinuteSection = await prisma.cvMinuteSection.create({
                data: {
                  cvMinuteId: cvMinute.id,
                  sectionId: section.id,
                  sectionOrder: s.order && Number(s.order),
                  sectionTitle: s.title,
                },
              });
            }

            if (typeof s.content === 'string') {
              await prisma.sectionInfo.create({
                data: {
                  cvMinuteSectionId: cvMinuteSection.id,
                  content: s.content,
                },
              });
            }

            await prisma.advice.create({
              data: {
                cvMinuteSectionId: cvMinuteSection.id,
                content: s.advice,
                type: 'advice',
              },
            });
          } else if (s.cvMinuteSectionId) {
            cvMinuteSection = await prisma.cvMinuteSection.update({
              where: { id: Number(s.cvMinuteSectionId) },
              data: { sectionTitle: s.title },
            });

            await prisma.advice.update({
              where: { id: Number(s.adviceId) },
              data: { content: s.advice },
            });
          }

          // SectionInfo
          if (s.withAdvice) {
            await prisma.sectionInfo.update({
              where: { id: Number(s.withAdvice.sectionInfoId) },
              data: { content: s.withAdvice.content },
            });

            await prisma.advice.update({
              where: { id: Number(s.withAdvice.adviceId) },
              data: { content: s.withAdvice.advice },
            });
          } else {
            for (const item of s.content) {
              if (typeof item === 'object') {
                await prisma.sectionInfo.update({
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
            }
          }
        }

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

        await prisma.advice.update({
          where: { id: cvMinuteAdvice.id },
          data: { content: jsonData.newSectionsAdvice },
        });
      }
    }

    cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: {
          include: {
            sectionInfos: { include: { evaluation: true, advices: true } },
            advices: true,
          },
        },
      },
    });

    sections = await prisma.section.findMany({
      where: { id: { in: cvMinute.cvMinuteSections.map((c) => c.sectionId) } },
    });

    res.status(200).json({
      cvMinute,
      sections,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { optimizeCvMinute };
