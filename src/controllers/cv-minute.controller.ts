import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import isEmpty from '../utils/isEmpty';

import { htmlToText } from 'html-to-text';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { imageMimeTypes } from '../utils/constants';
import { openai } from '../socket';
import { AdviceInterface } from 'interfaces/advice.interface';
import { CvMinuteSectionInterface } from 'interfaces/cvMinuteSection.interface';
import { SectionInterface } from 'interfaces/section.interface';
import { SectionInfoInterface } from 'interfaces/sectionInfo.interface';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

const getCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, evaluation: true },
    });

    const files = await prisma.file.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

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
          in: cvMinuteSections.map(
            (c: CvMinuteSectionInterface) => c.sectionId,
          ),
        },
      },
    });

    res.status(200).json({
      cvMinute,
      files,
      sections,
      cvMinuteSections,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const addCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const userId = res.locals.user.id;
    const body: { position: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvMinute = await prisma.cvMinute.create({
      data: {
        position: body.position.trim(),
        userId,
      },
    });

    // MIME type
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidDocument: true });
      return;
    } else {
      const extension = path.extname(req.file.originalname);
      const fileName = `cv-${userId}-${Date.now()}-${uniqueId}${extension}`;
      const directoryPath = path.join(
        __dirname,
        `../uploads/files/user-${userId}`,
      );
      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      await prisma.file.create({
        data: {
          name: fileName,
          extension,
          originalName: req.file.originalname,
          usage: 'cv',
          userId,
          cvMinuteId: cvMinute.id,
        },
      });

      // OPENAI
      let textData = null;
      if (req.file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        textData = pdfData.text;
      } else {
        const wordData = await mammoth.extractRawText({ path: filePath });
        textData = wordData.value;
      }

      const lignes = textData
        .split('\n')
        .map((ligne) => ligne.trim())
        .filter((ligne) => ligne.length > 0);

      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `
              Vous êtes un expert en redaction et optimisation de CV. 
              Identifie toutes les informations contenues dans le CV. 
              Faite les calculs pour avoir les scores de compatibilité.
              Règles à suivre:
              - Le retour doit contenir :
              {
                name: nom de la personne,
                firstname: prénom de la personne,
                cvTitle: 
                  {
                    title: string, titre du cv,
                    titleAdvice: string, 1 à 3 phrases de suggestions pour améliorer le titre, met à la ligne les phrases
                  },
                profilePresentation:
                  {
                    presentation: string, presentation du profil de la personne,
                    presentationAdvice: string, 1 à 3 phrases de suggestions pour améliorer la présenation du profil, met à la ligne les phrases
                  },
                contacts:  
                  [
                    {
                      contactIcon: string, un nom d'icone adapté au contenu, tiré de lucide-static,
                      contactContent: string, contenu du contact/lien/adresse,
                      contactOrder: string, commencant par 1 et s'incremente selon le nombre de contact, lien et adresse
                    }
                  ], 
                experiences: 
                  [
                    {
                      postTitle: string, titre du poste,
                      postDate: string, date de début et/ou fin, avec le mois et le jour si precisé,
                      postCompany: string, nom de l'entreprise,
                      postContrat: string, type de contrat,
                      postDescription: string, description du poste,
                      postOrder: string, commencant par 1 et s'incremente selon le nombre d'experiences,
                      postScore: string, score de compatibilité de l'expérience avec l'offre,
                      postHigh: string, 1 à 3 phrases expliquant les points forts de l'expérience en dépit du score, met à la ligne les phrases
                      postWeak: string, 1 à 3 phrases expliquant les points à améliorer à l'expérience en dépit du score, met à la ligne les phrases
                    }
                  ],
                sections: 
                  [
                    {
                      sectionTitle: string, titre de la section,
                      sectionContent: string, regroupe l'ensemble des contenus, garde les à la ligne lors du regroupement,
                      sectionOrder: string, commencant par 1 et s'incremente selon le nombre de sections,
                      sectionAdvice: string, 1 à 3 phrases de suggestions pour améliorer la section actuelle par rapport à l'offre, met à la ligne les phrases
                    }
                  ],
                newSectionsAdvice: string, 1 à 3 phrases de suggestions pour l'ajout de nouvelles sections qu'on appelera rubrique,
                evaluations:
                  {
                    globalScore: string, score de compatibilité global du contenu par rapport à l'offre,
                    recommendations: string, 1 à 3 phrases de recommendations d'améliorations en dépit du score, met à la ligne les phrases
                  } 
              }
              - La partie contacts contient tout les contacts, liens et/ou adresse de la personne.
              - Les restes du contenu seront considérés comme des sections.
              - S'il n'y a pas de contenu ou si le contenu est non determiné met 'à ajouter'.
              - Les scores seront des valeurs entre 0 et 100.
              - Donne la réponse en json simple.
            `,
          },
          {
            role: 'user',
            content: `Contenu du CV :\n${lignes.join('\n')}\n Offre: ${body.position}`,
          },
        ],
      });

      if (openaiResponse.id) {
        for (const r of openaiResponse.choices) {
          await prisma.openaiResponse.create({
            data: {
              responseId: openaiResponse.id,
              cvMinuteId: cvMinute.id,
              request: 'cv-infos',
              response: r.message.content,
              index: r.index,
            },
          });

          const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
          if (match) {
            const jsonString = match[1];
            const jsonData: {
              name: string;
              firstname: string;
              contacts: {
                contactIcon: string;
                contactContent: string;
                contactOrder: string;
              }[];
              cvTitle: {
                title: string;
                titleAdvice: string;
              };
              profilePresentation: {
                presentation: string;
                presentationAdvice: string;
              };
              experiences: {
                postTitle: string;
                postDate: string;
                postCompany: string;
                postContrat: string;
                postDescription: string;
                postOrder: string;
                postScore: string;
                postHigh: string;
                postWeak: string;
              }[];
              sections: {
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
            } = JSON.parse(jsonString);

            const allSections: {
              name: string;
              title?: string;
              order?: string;
              editable?: boolean;
              advice?: string;
              content?:
                | string
                | {
                    title?: string;
                    content?: string;
                    date?: string;
                    company?: string;
                    contrat?: string;
                    icon?: string;
                    iconSize?: number;
                    order?: string;

                    score?: string;
                    high?: string;
                    weak?: string;
                  }[];
              withAdvice?: {
                content: string;
                advice: string;
              };
            }[] = [
              { name: 'profile', content: 'cv-profile' },
              { name: 'name', content: jsonData.name },
              { name: 'firstname', content: jsonData.firstname },
              {
                name: 'contacts',
                content: jsonData.contacts.map(
                  (c: {
                    contactIcon: string;
                    contactContent: string;
                    contactOrder: string;
                  }) => ({
                    icon: c.contactIcon,
                    iconSize: 16,
                    content: c.contactContent,
                    order: c.contactOrder,
                  }),
                ),
              },
              {
                name: 'title',
                withAdvice: {
                  content: jsonData.cvTitle.title,
                  advice: jsonData.cvTitle.titleAdvice,
                },
              },
              {
                name: 'presentation',
                withAdvice: {
                  content: jsonData.profilePresentation.presentation,
                  advice: jsonData.profilePresentation.presentationAdvice,
                },
              },
              {
                name: 'experiences',
                content: jsonData.experiences.map(
                  (item: {
                    postTitle: string;
                    postDate: string;
                    postCompany: string;
                    postContrat: string;
                    postDescription: string;
                    postOrder: string;
                    postScore: string;
                    postHigh: string;
                    postWeak: string;
                  }) => ({
                    title: item.postTitle,
                    date: item.postDate,
                    company: item.postCompany,
                    contrat: item.postContrat,
                    content: item.postDescription,
                    order: item.postOrder,
                    score: item.postScore,
                    high: item.postHigh,
                    weak: item.postWeak,
                  }),
                ),
              },
              ...jsonData.sections.map((section) => ({
                name: section.sectionTitle.trim().toLocaleLowerCase(),
                title: section.sectionTitle.trim().toLocaleLowerCase(),
                content: section.sectionContent.trim(),
                order: section.sectionOrder,
                advice: section.sectionAdvice,
                editable: true,
              })),
            ];

            // CvMinuteSection
            for (const s of allSections) {
              let section = await prisma.section.findUnique({
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

              const cvMinuteSection = await prisma.cvMinuteSection.create({
                data: {
                  cvMinuteId: cvMinute.id,
                  sectionId: section.id,
                  sectionOrder: s.order && Number(s.order),
                  sectionTitle: s.title,
                },
              });

              if (s.advice) {
                await prisma.advice.create({
                  data: {
                    cvMinuteSectionId: cvMinuteSection.id,
                    content: s.advice,
                    type: 'advice',
                  },
                });
              }

              // SectionInfo
              if (typeof s.content === 'string') {
                await prisma.sectionInfo.create({
                  data: {
                    cvMinuteSectionId: cvMinuteSection.id,
                    content: s.content,
                    order: 1,
                  },
                });
              } else if (s.withAdvice) {
                const sectionInfo = await prisma.sectionInfo.create({
                  data: {
                    cvMinuteSectionId: cvMinuteSection.id,
                    content: s.withAdvice.content,
                    order: 1,
                  },
                });

                await prisma.advice.create({
                  data: {
                    sectionInfoId: sectionInfo.id,
                    content: s.withAdvice.advice,
                    type: 'advice',
                  },
                });
              } else {
                for (const item of s.content) {
                  const sectionInfo = await prisma.sectionInfo.create({
                    data: {
                      cvMinuteSectionId: cvMinuteSection.id,
                      title: item.title,
                      content: item.content,
                      date: item.date,
                      company: item.company,
                      contrat: item.contrat,
                      icon: item.icon,
                      iconSize: item.iconSize,
                      order: Number(item.order),
                    },
                  });

                  if (item.score) {
                    await prisma.evaluation.create({
                      data: {
                        sectionInfoId: sectionInfo.id,
                        initialScore: Number(item.score),
                        content: item.high,
                        weakContent: item.weak,
                      },
                    });
                  }
                }
              }
            }

            await prisma.evaluation.create({
              data: {
                cvMinuteId: cvMinute.id,
                initialScore: Number(jsonData.evaluations.globalScore),
                content: jsonData.evaluations.recommendations,
              },
            });

            await prisma.advice.create({
              data: {
                cvMinuteId: cvMinute.id,
                content: jsonData.newSectionsAdvice,
                type: 'advice',
              },
            });
          }
        }
      }
    }

    res.status(201).json({ cvMinuteId: cvMinute.id });
    return;
  } catch (error) {
    console.log('error:', error);
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteProfile = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let file = null;
    let sectionInfo = null;
    let cvMinuteSection = null;
    const userId = res.locals.user.id;
    const body: {
      cvMinuteSectionId: number | string;
      sectionInfoId?: number | string;
    } = req.body;
    const { cvMinute } = res.locals;

    if (
      isNaN(Number(body.cvMinuteSectionId)) ||
      (body.sectionInfoId && isNaN(Number(body.sectionInfoId)))
    ) {
      res.json({ invalidId: true });
      return;
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(body.cvMinuteSectionId) },
      select: { id: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    if (body.sectionInfoId) {
      sectionInfo = await prisma.sectionInfo.findUnique({
        where: { id: Number(body.sectionInfoId) },
        select: { id: true },
      });

      if (!sectionInfo) {
        res.json({ sectionInfoNotFound: true });
        return;
      }
    } else {
      sectionInfo = await prisma.sectionInfo.create({
        data: {
          cvMinuteSectionId: cvMinuteSection.id,
          content: 'cv-profile',
          order: 1,
        },
      });
    }

    file = await prisma.file.findUnique({
      where: { sectionInfoId: sectionInfo.id },
    });

    if (!imageMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidFormat: true });
      return;
    } else {
      const extension = path.extname(req.file.originalname);
      const fileName = `cv-profile-${userId}-${Date.now()}-${uniqueId}${extension}`;
      const directoryPath = path.join(
        __dirname,
        `../uploads/files/user-${userId}`,
      );

      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      if (file) {
        const filePath = path.join(directoryPath, file.name);
        fs.unlinkSync(filePath);

        file = await prisma.file.update({
          where: { id: file.id },
          data: {
            name: fileName,
            extension,
            originalName: req.file.originalname,
          },
        });
      } else {
        file = await prisma.file.create({
          data: {
            name: fileName,
            extension,
            originalName: req.file.originalname,
            usage: 'cv-profile',
            userId,
            cvMinuteId: cvMinute.id,
            sectionInfoId: sectionInfo.id,
          },
        });
      }
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
      },
    });
    res.status(200).json({ cvMinuteSection, file });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let section = null;
    let cvMinuteSection = null;
    let sectionInfo = null;

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

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, evaluation: true },
    });

    if (body.updateBg) {
      // update bg
      const updatedCvMinute = await prisma.cvMinute.update({
        where: { id: cvMinute.id },
        data: {
          primaryBg: body.primaryBg.trim(),
          secondaryBg: body.secondaryBg.trim(),
          tertiaryBg: body.tertiaryBg.trim(),
        },
      });

      res.status(200).json({ cvMinute: updatedCvMinute });
      return;
    } else if (body.updateContactSection) {
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
    } else if (body.newSection) {
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

          if (body.content !== sectionInfo.content) {
            sectionInfo = await prisma.sectionInfo.update({
              where: { id: body.sectionInfoId },
              data: { content: body.content.trim() || ' ' },
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
              content: body.content.trim() || ' ',
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
    } else if (body.updateExperience) {
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
          postTitle: ${sectionInfo.title}, 
          postDate: ${sectionInfo.date}, 
          postDescription: ${sectionInfo.content}, 
        `;

        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `
              Vous êtes un expert en redaction et optimisation de CV. 
              Faite les calculs pour avoir le score de compatibilité de l'experience par rapport à l'offre.
              Règles à suivre:
              - Le retour doit contenir :
                {
                  postScore: string, score de compatibilité de l'expérience avec l'offre,
                  postHigh: string, 1 à 3 phrases expliquant les points forts de l'expérience en dépit du score, met à la ligne les phrases
                  postWeak: string, 1 à 3 phrases expliquant les points à améliorer à l'expérience en dépit du score, met à la ligne les phrases
                }
              - Le score est une valeur entre 0 et 100.
              - Donne la réponse en json simple.
            `,
            },
            {
              role: 'user',
              content: `Experience :\n${details}\n Offre: ${cvMinute.position}`,
            },
          ],
        });

        if (openaiResponse.id) {
          for (const r of openaiResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiResponse.id,
                cvMinuteId: cvMinute.id,
                request: 'evaluation',
                response: r.message.content,
                index: r.index,
              },
            });

            const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) {
              const jsonString = match[1];
              const jsonData: {
                postScore: string;
                postHigh: string;
                postWeak: string;
              } = JSON.parse(jsonString);

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
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const optimizeCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
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
      .map((s) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        const cvMinuteSectionAdvice = cvMinuteSection.advices.find(
          (a) =>
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
      model: 'gpt-4-turbo-preview',
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

        const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const jsonString = match[1];
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
          } = JSON.parse(jsonString);

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

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      select: { sectionId: true, sectionTitle: true },
    });

    const sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map(
            (c: { sectionId: number; sectionTitle: string }) => c.sectionId,
          ),
        },
        editable: true,
      },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find((s: SectionInterface) => s.name === value);
      return cvMinuteSections.find(
        (c: { sectionId: number; sectionTitle: string }) =>
          c.sectionId === section?.id,
      );
    };

    const allCvMinuteSections = sections
      .map((s) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        return cvMinuteSection.sectionTitle;
      })
      .join(', ');

    const advice = cvMinute.advices.find(
      (a: { type: string }) => a.type === 'advice',
    );

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `
            Vous êtes un expert en redaction et optimisation de CV. 
            Selon l'offre et les conseils, propose des nouvelles sections adaptées à part les existantes.
            Règles à suivre:
            - Le retour doit contenir :
              { sections: [ ] }
            - Donne 1 à 3 propositions.
            - Donne la réponse en json simple.
          `,
        },
        {
          content: `Sections existantes :\n${allCvMinuteSections}\n Conseils :\n${advice.content} \n Offre: ${cvMinute.position}`,
          role: 'user',
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'advice',
            response: r.message.content,
            index: r.index,
          },
        });

        const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const jsonString = match[1];
          const jsonData: { sections: string[] } = JSON.parse(jsonString);

          for (const s of jsonData.sections) {
            await prisma.advice.create({
              data: {
                cvMinuteId: cvMinute.id,
                content: s,
                type: 'suggestion',
              },
            });
          }
        }
      }
    }

    const updatedCvMinute = await prisma.cvMinute.findUnique({
      where: { id: cvMinute.id },
      include: { advices: true },
    });
    res.status(200).json({ cvMinute: updatedCvMinute });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const generateSectionInfoAdvice = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let sectionInfo = null;
    let messageSystem = null;
    let messageUser = null;
    const { cvMinute } = res.locals;
    const { sectionInfoId } = req.params;
    const body: { section: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    sectionInfo = await prisma.sectionInfo.findUnique({
      where: { id: Number(sectionInfoId) },
      include: { advices: true },
    });

    if (!sectionInfo) {
      res.json({ sectionInfoNotFound: true });
      return;
    }

    const advice = sectionInfo?.advices.find(
      (a: AdviceInterface) => a.type === 'advice',
    )?.content;

    if (body.section === 'title') {
      messageSystem = `
        Vous êtes un expert en redaction et optimisation de CV. 
        Selon l'offre et les conseils, donne des propositions adaptées pour le titre du CV. 
        Règles à suivre:
        - Le retour doit contenir :
          { advices: [] }
        - Donne 1 à 3 propositions.
        - Donne directement les propositions sans contenu introductive ou explicative.
        - Donne la réponse en json simple.
        `;

      messageUser = `Titre actuel :\n${sectionInfo.content}\n Conseils :\n${advice} \n Offre: ${cvMinute.position}`;
    } else if (body.section === 'presentation') {
      messageSystem = `
        Vous êtes un expert en redaction et optimisation de CV. 
        Selon l'offre et les conseils, donne des propositions adaptées pour la présentation du profil. 
        Règles à suivre:
        - Le retour doit contenir :
        { advices: [] }
        - Donne 1 à 3 propositions explicites.
        - Donne directement les propositions sans contenu introductive ou explicative.
        - Donne la réponse en json simple.
        `;

      messageUser = `Présentation actuelle :\n${sectionInfo.content}\n Conseils :\n${advice} \n Offre: ${cvMinute.position}`;
    } else if (body.section === 'experience') {
      messageSystem = `
        Vous êtes un expert en redaction et optimisation de CV. 
        Selon l'offre et les conseils, donne des propositions adaptées à ajouter à la description actuelle. 
        Règles à suivre:
        - Le retour doit contenir :
        { advices: [] }
        - Donne 1 à 3 propositions.
        - Donne directement les propositions sans contenu introductive ou explicative.
        - Donne la réponse en json simple.
      `;

      messageUser = `Titre du poste: ${sectionInfo.title}\n Description actuelle : ${sectionInfo.content}\n Conseils : ${advice}\n Offre: ${cvMinute.position}`;
    }

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: messageSystem,
        },
        {
          content: messageUser,
          role: 'user',
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'advice',
            response: r.message.content,
            index: r.index,
          },
        });

        const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const jsonString = match[1];
          const jsonData: { advices: string[] } = JSON.parse(jsonString);

          for (const item of jsonData.advices) {
            await prisma.advice.create({
              data: {
                sectionInfoId: sectionInfo.id,
                content: item,
                type: 'suggestion',
              },
            });
          }
        }
      }
    }

    sectionInfo = await prisma.sectionInfo.findUnique({
      where: { id: Number(sectionInfoId) },
      include: { advices: true },
    });
    res.status(200).json({ sectionInfo });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteScore = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let evaluation = null;
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
      include: { advices: true, evaluation: true },
    });

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
    const editableSections = sections.filter((s) => s.editable);
    const allCvMinuteSections = editableSections
      .map((s) => {
        const cvMinuteSection = getCvMinuteSection(s.name);
        return `${cvMinuteSection.sectionTitle}: ${cvMinuteSection.sectionInfos[0].content}`;
      })
      .join('\n');

    const cvDetails = `
      cvTitle: ${title.sectionInfos[0].content}, 
      profilePresentation: ${presentation.sectionInfos[0].content}, 
      experiences: ${experiences.sectionInfos.map((item: SectionInfoInterface, index: number) => `${index}. poste: ${item.title}, contrat: ${item.contrat}, description: ${item.content}`).join('\n')}, 
      ${allCvMinuteSections}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `
            Vous êtes un expert en redaction et optimisation de CV. 
            Faite les calculs pour avoir les scores de compatibilité.
            Règles à suivre:
            - Le retour doit contenir :
            { 
              globalScore: score de compatibilité global du contenu,
              recommendations: 1 à 3 phrases de recommendations par rapport à l'offre en dépit du score, met à la ligne chaque phrase
            }
            - Les scores seront des valeurs entre 0 et 100.
            - Donne la réponse en json simple.
          `,
        },
        {
          content: `Contenu du CV :\n${cvDetails}\n Offre: ${cvMinute.position}`,
          role: 'user',
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'matching-score',
            response: r.message.content,
            index: r.index,
          },
        });
        const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const jsonString = match[1];
          const jsonData: { globalScore: string; recommendations: string } =
            JSON.parse(jsonString);

          evaluation = await prisma.evaluation.update({
            where: { id: cvMinute.evaluation.id },
            data: {
              actualScore: Number(jsonData.globalScore),
              content: jsonData.recommendations,
            },
          });
        }
      }
    }

    res.status(200).json({ evaluation });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSectionInfoOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let section = null;
    let targetSection = null;
    const body: { sectionInfoId: number; targetSectionInfoId: number } =
      req.body;

    section = await prisma.sectionInfo.findUnique({
      where: { id: body.sectionInfoId },
      select: { id: true, order: true },
    });
    targetSection = await prisma.sectionInfo.findUnique({
      where: { id: body.targetSectionInfoId },
      select: { id: true, order: true },
    });

    const tempOrder = section.order;
    section = await prisma.sectionInfo.update({
      where: { id: section.id },
      data: { order: targetSection.order },
    });
    targetSection = await prisma.sectionInfo.update({
      where: { id: targetSection.id },
      data: { order: tempOrder },
    });

    res.status(200).json({ section, targetSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSectionInfoScore = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let sectionInfo = null;
    let evaluation = null;
    const { cvMinute } = res.locals;
    const { sectionInfoId } = req.params;

    sectionInfo = await prisma.sectionInfo.findUnique({
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
      titre: ${sectionInfo.title}, 
      contrat: ${sectionInfo.contrat}, 
      description: ${sectionInfo.content}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `
          Vous êtes un expert en redaction et optimisation de CV. 
          Faite les calculs pour avoir le score de compatibilité entre une expérience et une offre.
          Règles à suivre:
            - Le retour doit contenir :
            { 
              score: score de compatibilité global du contenu,
              postHigh: 1 à 3 phrases expliquant les points forts de l'expérience en dépit du score,
              postWeak: 1 à 3 phrases expliquant les points à améliorer à l'expérience en dépit du score
            }
            - Le score est une valeur entre 0 et 100.
            - Met toujours à la ligne chaque phrase pour les explications.
            - Donne la réponse en json simple.
          `,
        },
        {
          content: `Contenu de l'expérience :\n${experience}\n Offre: ${cvMinute.position}`,
          role: 'user',
        },
      ],
    });

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'matching-score',
            response: r.message.content,
            index: r.index,
          },
        });
        const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const jsonString = match[1];
          const jsonData: {
            score: string;
            postHigh: string;
            postWeak: string;
          } = JSON.parse(jsonString);

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
    }

    res.status(200).json({ evaluation });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteSectionOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvMinuteSection = null;
    let targetCvMinuteSection = null;
    const body: { cvMinuteSectionId: number; targetCvMinuteSectionId: number } =
      req.body;

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.cvMinuteSectionId },
      select: { id: true, sectionOrder: true },
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.targetCvMinuteSectionId },
      select: { id: true, sectionOrder: true },
    });

    const tempOrder = cvMinuteSection.sectionOrder;
    cvMinuteSection = await prisma.cvMinuteSection.update({
      where: { id: cvMinuteSection.id },
      data: { sectionOrder: targetCvMinuteSection.sectionOrder },
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.update({
      where: { id: targetCvMinuteSection.id },
      data: { sectionOrder: tempOrder },
    });

    res.status(200).json({ cvMinuteSection, targetCvMinuteSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const deleteSectionInfo = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { sectionInfoId } = req.params;

    if (!sectionInfoId || isNaN(Number(sectionInfoId))) {
      res.json({ invalidSectionInfoId: true });
      return;
    }
    const section = await prisma.sectionInfo.delete({
      where: { id: Number(sectionInfoId) },
    });

    res.status(200).json({ section });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const deleteCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { cvMinuteSectionId } = req.params;

    if (!cvMinuteSectionId || isNaN(Number(cvMinuteSectionId))) {
      res.json({ invalidCvMinuteSectionId: true });
      return;
    }
    const cvMinuteSection = await prisma.cvMinuteSection.delete({
      where: { id: Number(cvMinuteSectionId) },
    });

    res.status(200).json({ cvMinuteSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export {
  getCvMinute,
  addCvMinute,
  updateCvMinuteProfile,
  updateCvMinuteSection,
  optimizeCvMinute,
  generateCvMinuteSectionAdvice,
  generateSectionInfoAdvice,
  updateCvMinuteScore,
  updateSectionInfoOrder,
  updateSectionInfoScore,
  updateCvMinuteSectionOrder,
  deleteSectionInfo,
  deleteCvMinuteSection,
};
