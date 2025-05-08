import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

import { validationResult } from 'express-validator';
import { PrismaClient } from '@/prisma/client';
import { openai } from '@/socket';
import { extractJson } from '@/utils/functions';
import { domains, formattedDate } from '@/utils/constants';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

const addCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
    const body: { position: string } = req.body;

    const name = `CV du ${formattedDate}`;

    const cvMinute = await prisma.cvMinute.create({
      data: {
        position: body.position.trim(),
        userId: user.id,
        name,
      },
    });

    // MIME TYPE
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!req.file) {
      res.json({ fileNotFound: true });
      return;
    } else if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidDocument: true });
      return;
    } else {
      const extension = path.extname(req.file.originalname);
      const fileName = `cv-${user.id}-${Date.now()}-${uniqueId}${extension}`;
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(uploadsBase, `/files/user-${user.id}`);
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
          userId: user.id,
          cvMinuteId: cvMinute.id,
        },
      });

      // OPENAI
      let textData = '';
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
              Tu es un expert en rédaction et optimisation de CV.

              Mission :
              À partir du contenu du CV et de l’offre ciblée, 
              - Extraire les informations du CV.
              - Attribue 1 à 3 domaines le profil.
              - Évaluer la compatibilité avec l'offre ciblée.
              - Retourner une structure JSON strictement conforme au format donné.

              Domaines : 
              - ${domains.map((d) => d.label).join('- \n')}

              Contraintes :
              - Tous les champs doivent être présents, même si vides ou "à ajouter".
              - Scores entre 0 et 100.
              - Les phrases doivent être claires, aérées (retours à la ligne quand nécessaire).
              - Utilise des icônes de lucide-static pour les contacts.
              - Choisir parmis les domaines données.
              - Donne uniquement un objet JSON (pas de texte autour).
              - Respecter les sauts à la ligne demandé.
              - Ne jamais sortir du format demandé.
              
              Format attendu :
              {
                name: string,
                firstname: string,
                cvTitle: {
                  title: string,
                  titleAdvice: string
                },
                profilePresentation: {
                  presentation: string,
                  presentationAdvice: string
                },
                contacts: [
                  {
                    contactIcon: string,
                    contactContent: string,
                    contactOrder: string
                  }
                ],
                experiences: [
                  {
                    postTitle: string,
                    postDate: string,
                    postCompany: string,
                    postContrat: string,
                    postDescription: string,
                    postOrder: string,
                    postScore: string,
                    postHigh: string,
                    postWeak: string
                  }
                ],
                sections: [
                  {
                    sectionTitle: string,
                    sectionContent: string,
                    sectionOrder: string,
                    sectionAdvice: string
                  }
                ],
                domains: [...],
                newSectionsAdvice: string,
                evaluations: {
                  globalScore: string,
                  recommendations: string
                }
              }
            `.trim(),
          },
          {
            role: 'user',
            content: `
              CV :
              ${lignes.join('\n')}

              Offre ciblée :
              ${body.position}
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
              request: 'cv-infos',
              response: r.message.content ?? 'cv-infos-response',
              index: r.index,
            },
          });

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
            domains: string[];
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

          // CVMINUTE SECTION
          await Promise.all(
            allSections.map(async (s) => {
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
                  sectionOrder: s.order ? Number(s.order) : 1,
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

              // SECTIONI INFO
              if (s.content && typeof s.content === 'string') {
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
                if (Array.isArray(s.content)) {
                  await Promise.all(
                    s.content.map(async (item) => {
                      const sectionInfo = await prisma.sectionInfo.create({
                        data: {
                          cvMinuteSectionId: cvMinuteSection.id,
                          title: item.title,
                          content: item.content ?? '',
                          date: item.date,
                          company: item.company,
                          contrat: item.contrat,
                          icon: item.icon,
                          iconSize: 16,
                          order: Number(item.order),
                        },
                      });

                      if (item.score) {
                        await prisma.evaluation.create({
                          data: {
                            sectionInfoId: sectionInfo.id,
                            initialScore: Number(item.score),
                            content: item.high ?? '',
                            weakContent: item.weak,
                          },
                        });
                      }
                    }),
                  );
                }
              }
            }),
          );

          // CREATE DOMAIN
          await Promise.all(
            jsonData.domains.map(async (item) => {
              const existDomain = await prisma.cvMinuteDomain.findFirst({
                where: { content: item.trim() },
              });

              if (!existDomain) {
                await prisma.cvMinuteDomain.create({
                  data: {
                    content: item.trim(),
                    cvMinuteId: cvMinute.id,
                    userId: user.id,
                  },
                });
              }
            }),
          );

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

    const cvMinuteCount = await prisma.cvMinute.count({
      where: { userId: user.id },
    });

    res.status(201).json({ cvMinuteId: cvMinute.id, cvMinuteCount });
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

export { addCvMinute };
