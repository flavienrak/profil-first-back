import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import isEmpty from '../utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { imageMimeTypes } from '../utils/constants';
import { openai } from '../socket';

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
        sectionInfos: { include: { evaluation: true, advice: true } },
        advices: true,
      },
    });

    const sections = await prisma.section.findMany({
      where: { id: { in: cvMinuteSections.map((c) => c.sectionId) } },
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
              1. Le retour doit contenir :
              {
                name: nom de la personne,
                firstname: prénom de la personne,
                cvTitle: 
                  {
                    title: titre du cv,
                    titleAdvice: 1 à 3 phrases de suggestions pour améliorer le titre
                  },
                profilePresentation:
                  {
                    presentation: presentation du profil de la personne,
                    presentationAdvice: 1 à 3 phrases de suggestions pour améliorer la présenation du profil
                  },
                contacts:  
                  [
                    {
                      contactIcon: nom de l'icone associé au contenu tiré de lucide-static,
                      contactContent: contenu du contact/lien/adresse,
                      contactOrder: commencant par 1 et s'incremente selon le nombre de contact, lien et adresse
                    }
                  ], 
                experiences: 
                  [
                    {
                      postTitle: titre du poste,
                      postDate: date de début et/ou fin, avec le mois et le jour si precisé,
                      postCompany: nom de l'entreprise,
                      postContrat: type de contrat,
                      postDescription: description du poste,
                      postOrder: commencant par 1 et s'incremente selon le nombre d'experiences,
                      postScore: score de compatibilité de l'expérience avec l'offre,
                      postHigh: 1 à 3 phrases explicites expliquant les points forts de l'expérience en dépit du score,
                      postWeak: 1 à 3 phrases explicites expliquant les points à améliorer à l'expérience en dépit du score
                    }
                  ],
                sections: 
                  [
                    {
                      sectionTitle: titre de la section,
                      sectionContent: regroupe l'ensemble des contenus, garde les '\n' lors du regroupement,
                      sectionOrder: commencant par 1 et s'incremente selon le nombre de sections,
                      sectionAdvice: 1 à 3 phrases explicites de suggestions pour améliorer la section actuelle par rapport à l'offre
                    }
                  ],
                newSectionsAdvice: 1 à 3 phrases explicites de suggestions pour l'ajout de nouvelles sections qu'on appelera rubrique,
                evaluations:
                  {
                    globalScore: score de compatibilité global du contenu par rapport à l'offre,
                    recommendations: 1 à 3 phrases explicites de recommendations d'améliorations en dépit du score 
                  } 
              }
              2. La partie contacts contient tout les contacts, liens et/ou adresse de la personne.
              3. Les restes du contenu seront considérés comme des sections.
              4. S'il n'y a pas de contenu ou si le contenu est non determiné met 'à ajouter'.
              5. Met toujours des '\n' entre les phrases de suggestions, explications ou de recommendations.
              6. Les scores seront des valeurs entre 0 et 100.
              7. Donne la réponse en json simple.
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
                contactIcon?: string;
                contactContent?: string;
                contactOrder?: string;
              }[];
              cvTitle?: {
                title?: string;
                titleAdvice?: string;
              };
              profilePresentation?: {
                presentation?: string;
                presentationAdvice?: string;
              };
              experiences: {
                postTitle?: string;
                postDate?: string;
                postCompany?: string;
                postContrat?: string;
                postDescription?: string;
                postOrder?: string;
                postScore?: string;
                postHigh?: string;
                postWeak?: string;
              }[];
              sections: {
                sectionTitle?: string;
                sectionContent?: string;
                sectionOrder?: string;
                sectionAdvice?: string;
              }[];
              newSectionsAdvice?: string;
              evaluations?: {
                globalScore?: string;
                recommendations?: string;
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
                content?: string;
                advice?: string;
              };
            }[] = [
              { name: 'profile', content: 'cv-profile' },
              { name: 'name', content: jsonData.name },
              { name: 'firstname', content: jsonData.firstname },
              {
                name: 'contacts',
                content: jsonData.contacts.map((c) => ({
                  icon: c.contactIcon,
                  iconSize: 16,
                  content: c.contactContent,
                  order: c.contactOrder,
                })),
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
                content: jsonData.experiences.map((item) => ({
                  title: item.postTitle,
                  date: item.postDate,
                  company: item.postCompany,
                  contrat: item.postContrat,
                  content: item.postDescription,
                  order: item.postOrder,
                  score: item.postScore,
                  high: item.postHigh,
                  weak: item.postWeak,
                })),
              },
              ...jsonData.sections.map((section) => ({
                name: section.sectionTitle,
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
                    type: 'existSection',
                  },
                });
              }

              // SectionInfo
              if (typeof s.content === 'string') {
                await prisma.sectionInfo.create({
                  data: {
                    cvMinuteSectionId: cvMinuteSection.id,
                    content: s.content,
                  },
                });
              } else if (s.withAdvice) {
                const sectionInfo = await prisma.sectionInfo.create({
                  data: {
                    cvMinuteSectionId: cvMinuteSection.id,
                    content: s.withAdvice.content,
                  },
                });

                await prisma.advice.create({
                  data: {
                    sectionInfoId: sectionInfo.id,
                    content: s.withAdvice.advice,
                    type: 'existSection',
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
                type: 'newSection',
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
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    if (body.sectionInfoId) {
      sectionInfo = await prisma.sectionInfo.findUnique({
        where: { id: Number(body.sectionInfoId) },
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
        sectionInfos: { include: { evaluation: true, advice: true } },
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

    const body: {
      sectionOrder?: number;
      sectionTitle?: string;
      sectionInfoId?: number;
      sectionInfoOrder?: number;

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

    const { cvMinute } = res.locals;

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
      });

      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      }

      const infosToUpdate = {
        content: body.content.trim(),
        icon: body.icon.trim(),
        iconSize: body.iconSize,
        order: body.sectionInfoOrder,
      };

      // (update | create) sectionInfo
      if (body.sectionInfoId) {
        sectionInfo = await prisma.sectionInfo.update({
          where: { id: body.sectionInfoId },
          data: infosToUpdate,
        });
      } else {
        sectionInfo = await prisma.sectionInfo.create({
          data: { cvMinuteSectionId: body.cvMinuteSectionId, ...infosToUpdate },
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
            },
          });

          cvMinuteSection = await prisma.cvMinuteSection.findUnique({
            where: { id: cvMinuteSection.id },
            include: { sectionInfos: true },
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
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: { sectionInfos: true },
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
          sectionInfo = await prisma.sectionInfo.create({
            data: {
              cvMinuteSectionId: cvMinuteSection.id,
              content: body.content.trim() || ' ',
            },
          });
        }

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: { sectionInfos: true },
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
        order: body.sectionInfoOrder,
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
        sectionInfo = await prisma.sectionInfo.create({
          data: {
            ...infosToUpdate,
            cvMinuteSectionId: cvMinuteSection.id,
          },
        });
      }
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: {
        sectionInfos: { include: { evaluation: true, advice: true } },
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
        sectionInfos: { include: { evaluation: true, advice: true } },
        advices: true,
      },
    });

    const sections = await prisma.section.findMany({
      where: { id: { in: cvMinuteSections.map((c) => c.sectionId) } },
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
        return `${cvMinuteSection.sectionTitle}: ${cvMinuteSection.sectionInfos[0].content}`;
      })
      .join('\n');

    const cvDetails = `
      cvTitle: ${title.sectionInfos[0].content}, 
      profilePresentation: ${presentation.sectionInfos[0].content}, 
      experiences: ${experiences.sectionInfos.map((item, index) => `${index}. poste: ${item.title}, contrat: ${item.contrat}, description: ${item.content}`).join('\n')}, 
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
            1. Le retour doit contenir :
            { 
              globalScore: score de compatibilité global du contenu,
              recommendations: 1 à 3 phrases explicites de recommendations par rapport à l'offre en dépit du score, met '\n' entre les phrases
            }
            2. Les scores seront des valeurs entre 0 et 100.
            3. Donne la réponse en json simple.
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
      include: {
        evaluation: true,
        advice: true,
      },
    });
    targetSection = await prisma.sectionInfo.findUnique({
      where: { id: body.targetSectionInfoId },
      include: {
        evaluation: true,
        advice: true,
      },
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
      include: { evaluation: true, advice: true },
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
            1. Le retour doit contenir :
            { 
              score: score de compatibilité global du contenu,
              postHigh: 1 à 3 phrases explicites expliquant les points forts de l'expérience en dépit du score,
              postWeak: 1 à 3 phrases explicites expliquant les points à améliorer à l'expérience en dépit du score
            }
            2. Le score est une valeur entre 0 et 100.
            3. Met toujours des '\n' entre les phrases d'explications.
            4. Donne la réponse en json simple.
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
      include: {
        sectionInfos: { include: { evaluation: true, advice: true } },
      },
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.targetCvMinuteSectionId },
      include: {
        sectionInfos: { include: { evaluation: true, advice: true } },
      },
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
  updateCvMinuteScore,
  updateSectionInfoOrder,
  updateSectionInfoScore,
  updateCvMinuteSectionOrder,
  deleteSectionInfo,
  deleteCvMinuteSection,
};
