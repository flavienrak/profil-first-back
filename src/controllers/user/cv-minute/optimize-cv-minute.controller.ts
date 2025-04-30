import { Request, Response } from 'express';

import { htmlToText } from 'html-to-text';
import { PrismaClient } from '@prisma/client';
import { openai } from '../../../socket';
import { AdviceInterface } from '../../../interfaces/cv-minute/advice.interface';
import { CvMinuteSectionInterface } from '../../../interfaces/cv-minute/cvMinuteSection.interface';
import { SectionInterface } from '../../../interfaces/cv-minute/section.interface';
import { extractJson } from '../../../utils/functions';

const prisma = new PrismaClient();

const optimizeCvMinute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, evaluation: true },
    });

    let cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
        advices: true,
      },
    });

    let sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map(
            (c: CvMinuteSectionInterface) => c.sectionId,
          ),
        },
      },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find((s: SectionInterface) => s.name === value);
      return cvMinuteSections.find(
        (c: CvMinuteSectionInterface) => c.sectionId === section?.id,
      );
    };

    const title = getCvMinuteSection('title');
    const presentation = getCvMinuteSection('presentation');
    const experiences = getCvMinuteSection('experiences');
    const editableSections = sections.filter(
      (s: SectionInterface) => s.editable,
    );

    const titleAdvice = title?.sectionInfos[0].advices.find(
      (a: AdviceInterface) => a.type === 'advice',
    );
    const existTitle = `
      sectionInfoId: ${title?.sectionInfos[0]?.id}, 
      adviceId: ${titleAdvice?.id}, 
      cvTitle: ${title?.sectionInfos[0]?.content}, 
      advices: ${titleAdvice?.content}
    `;

    const presentationAdvice = presentation?.sectionInfos[0].advices.find(
      (a: AdviceInterface) => a.type === 'advice',
    );
    const existPresentation = `
      sectionInfoId:${presentation?.sectionInfos[0]?.id}, 
      adviceId: ${presentationAdvice.id}, 
      profilePresentation: ${presentation?.sectionInfos[0]?.content}, 
      advices: ${presentationAdvice?.content}
    `;

    const newSectionsAdvice = cvMinute.advices.find(
      (a: AdviceInterface) => a.type === 'advice',
    );
    const newSections = `
    adviceId: ${newSectionsAdvice?.id}, 
    newSectionsAdvice: ${newSectionsAdvice?.content}
    `;

    const existSections = editableSections
      .map((s: SectionInterface) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        const cvMinuteSectionAdvice = cvMinuteSection.advices.find(
          (a: AdviceInterface) =>
            a.cvMinuteSectionId === cvMinuteSection.id && a.type === 'advice',
        );

        return `
          cvMinuteSectionId: ${cvMinuteSection?.id}, 
          adviceId: ${cvMinuteSectionAdvice?.id}, 
          sectionTitle: ${cvMinuteSection.sectionTitle}, 
          sectionContent: ${cvMinuteSection?.sectionInfos[0]?.content}, 
          sectionAdvice: ${cvMinuteSectionAdvice?.content}
        `;
      })
      .join('\n');

    const existExperiences = experiences.sectionInfos
      .map((item: any) => {
        return `
          sectionInfoId:${item.id},
          evaluationId: ${item.evaluation.id}, 
          postTitle: ${item.title}, 
          postDate: ${item.date},
          postDescription: ${htmlToText(item.content)}, 
          postHigh: ${item.evaluation.content},
          postWeak: ${item.evaluation.weakContent}
        `;
      })
      .join('\n');

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
            Vous êtes un expert en redaction et optimisation de CV. 
            Selon l'offre et les conseils, optimize les contenus actuels.
            Faite les calculs pour avoir les scores de compatibilité.
            Eviter les pertes de données, les données en sorties doivent être supérieurs ou égales au nombres de données en entrées.
            Règles à suivre:
            - Le retour doit contenir :
            {
              cvTitle: 
                {
                  sectionInfoId: en pas changer, sectionInfoId en entrée,
                  adviceId: ne pas changer, adviceId en entrée,
                  title: string, titre du cv, courte et qui reflète bien l'offre, 
                  titleAdvice: string, 1 à 3 phrases de suggestions pour améliorer le titre, met à la ligne les phrases
                },
              profilePresentation:
                {
                  sectionInfoId: ne pas changer, sectionInfoId en entrée,
                  adviceId: ne pas changer, adviceId en entrée,
                  presentation: string, presentation du profil de la personne, à refaire, très explicite, 
                  presentationAdvice: string, 1 à 3 phrases de suggestions pour améliorer la présenation du profil, met à la ligne les phrases
                },
              experiences: 
                [
                  {
                    sectionInfoId: ne pas changer, sectionInfoId en entrée,
                    evaluationId: ne pas changer, evaluationId en entrée,
                    postTitle: ne pas changer, postTitle en entrée,
                    postDescription: string, description du poste, à refaire, très explicite, 
                    postDate: ne pas changer, postDate en entrée, 
                    postOrder: string, commencant par 1 du plus récent au plus ancien, 
                    postScore: string, score de compatibilité de l'expérience avec l'offre,
                    postHigh: string, 1 à 3 phrases expliquant les points forts de l'expérience en dépit du score, met à la ligne les phrases
                    postWeak: string, 1 à 3 phrases expliquant les points à améliorer à l'expérience en dépit du score, met à la ligne les phrases
                  }
                ],
              sections: 
                [
                  {
                    cvMinuteSectionId: ne pas changer, cvMinuteSectionId en entrée, met 'new' à la place si c'est nouvelle,
                    adviceId: ne pas changer, adviceId en entrée, met 'new' à la place si c'est nouvelle, 
                    sectionTitle: string, titre de la section,
                    sectionContent: string, regroupe l'ensemble des contenus, garde les à la ligne lors du regroupement, explicite, 
                    sectionOrder: string, commencant par 1 et s'incremente selon le nombre de sections,
                    sectionAdvice: string, 1 à 3 phrases de suggestions pour améliorer la section actuelle par rapport à l'offre, met à la ligne les phrases
                  }
                ],
              newSectionsAdvice:  string, 1 à 3 phrases de suggestions pour l'ajout de nouvelles sections qu'on appelera rubrique,
              evaluations:
                {
                  globalScore: string, score de compatibilité global du nouveau contenu par rapport à l'offre,
                  recommendations: string, 1 à 3 phrases de recommendations d'améliorations en dépit du score, met à la ligne les phrases
                } 
            }
            - Ne pas changer les sections formations, centres d'intérêt, certification et diplômes, renvoi juste les données en entrées, 
            - Génére des nouvelles sections avec leurs contenus selon les conseils.
            - Les scores seront des valeurs entre 0 et 100.
            - Optimiser tout les contenus pour que les scores soient au maximum.
            - Donne la réponse en json simple.
          `,
        },
        {
          role: 'user',
          content: `Contenu du CV :\n${existTitle}\n ${existPresentation}\n ${existSections}\n ${existExperiences}\n ${newSections}\n Offre: ${cvMinute.position}`,
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
      include: { advices: true, evaluation: true },
    });

    cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
        advices: true,
      },
    });

    sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map(
            (c: CvMinuteSectionInterface) => c.sectionId,
          ),
        },
      },
    });

    res.status(200).json({
      cvMinute,
      sections,
      cvMinuteSections,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { optimizeCvMinute };
