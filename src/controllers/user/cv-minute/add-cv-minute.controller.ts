import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { openai } from '../../../socket';
import { extractJson } from '../../../utils/functions';
import { formattedDate } from '../../../utils/constants';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

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

    const name = `CV du ${formattedDate}`;

    const cvMinute = await prisma.cvMinute.create({
      data: {
        position: body.position.trim(),
        userId,
        name,
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
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(uploadsBase, `/files/user-${userId}`);
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
              Eviter les pertes de données.
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

    const cvMinuteCount = await prisma.cvMinute.count({
      where: { userId },
    });

    res.status(201).json({ cvMinuteId: cvMinute.id, cvMinuteCount });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { addCvMinute };
