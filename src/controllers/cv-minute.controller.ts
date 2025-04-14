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
    const { cvMinute } = res.locals;

    const files = await prisma.file.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: { sectionInfos: true, advices: true },
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
            content: `Vous êtes un expert en redaction de CV. 
          Identifie toutes les informations contenues dans le CV.
          Règles à suivre:
          1. name: nom de la personne
          2. firstname: prénom de la personne
          4. contacts: tout les contacts, liens et/ou adresse de la personne. contactIcon: le nom de l'icone associé au contenu tiré de lucide-static, contactContent: contenu du contact/lien/adresse, contactOrder: commencant par 1 et s'incremente selon le nombre de contact, lien et adresse
          5. title: titre du cv
          6. presentation: presentation du profil de la personne
          7. experiences: 
          - postTitle: titre du poste
          - postDate: date de début et/ou fin, avec le mois et le jour si precisé
          - postCompany: nom de l'entreprise
          - postContrat: type de contrat
          - postDescription: description du poste
          - postOrder: commencant par 1 et s'incremente selon le nombre d'experiences
          5. Les restes seront consideres comme des sections. Une section aura un titre sectionTitle, sectionOrder commencant par 1 et s'incremente selon le nombre de sections, sectionContent qui regroupe l'ensemble des contenus, garde les '\n' lors du regroupement
          6. S'il n'y a pas de contenu ou si le contenu est non determiné met 'à ajouter'.
          7. Donne la réponse en json simple.`,
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
              title: string;
              presentation: string;
              experiences: {
                postTitle?: string;
                postDate?: string;
                postCompany?: string;
                postContrat?: string;
                postDescription?: string;
                postOrder?: string;
              }[];
              sections: {
                sectionTitle?: string;
                sectionContent?: string;
                sectionOrder?: string;
                sectionEditable?: boolean;
              }[];
            } = JSON.parse(jsonString);

            const allSections: {
              name: string;
              title?: string;
              order?: string;
              editable?: boolean;
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
                  }[];
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
              { name: 'title', content: jsonData.title },
              { name: 'presentation', content: jsonData.presentation },
              {
                name: 'experiences',
                content: jsonData.experiences.map((item) => ({
                  title: item.postTitle,
                  date: item.postDate,
                  company: item.postCompany,
                  contrat: item.postContrat,
                  content: item.postDescription,
                  order: item.postOrder,
                })),
              },
              ...jsonData.sections.map((section) => ({
                name: section.sectionTitle,
                title: section.sectionTitle.trim().toLocaleLowerCase(),
                content: section.sectionContent.trim(),
                order: section.sectionOrder,
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

              // SectionInfo
              if (typeof s.content === 'string') {
                await prisma.sectionInfo.create({
                  data: {
                    cvMinuteSectionId: cvMinuteSection.id,
                    content: s.content,
                  },
                });
              } else {
                for (const item of s.content) {
                  await prisma.sectionInfo.create({
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
                }
              }
            }
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
      include: { sectionInfos: true },
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
      include: { sectionInfos: true, advices: true },
    });

    res.status(200).json({ cvMinuteSection });
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
    });
    targetSection = await prisma.sectionInfo.findUnique({
      where: { id: body.targetSectionInfoId },
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
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.targetCvMinuteSectionId },
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

// OPENAI
const openaiController = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let jsonData;
    const jsonResponse =
      '```json\n{\n  "name": "MARTIN",\n  "firstname": "Raphaël",\n  "title": "DIRECTEUR COMMERCIAL",\n  "presentation": "Commercial diplômé, j’ai une expérience de 3 ans en tant qu’Assistant Commercial, et 4 ans en tant que Commercial chez DIOR. Je suis passionné et ai un bon sens relationnel que je saurai mettre au service de votre entreprise.",\n  "contacts": [\n    {\n      "contactIcon": "phone",\n      "contactContent": "06 06 06 06 06"\n    },\n    {\n      "contactIcon": "mail",\n      "contactContent": "raphael.martin@gnail.com"\n    },\n    {\n      "contactIcon": "mapPin",\n      "contactContent": "Paris, France"\n    },\n    {\n      "contactIcon": "linkedin",\n      "contactContent": "linkedin.com/raphael-martin"\n    }\n  ],\n  "experiences": [\n    {\n      "postTitle": "Commercial",\n      "postDate": "2019 – 2022",\n      "postCompany": "DIOR, Paris",\n      "postContrat": "CDI",\n      "postDescription": "Prospection commercial et gestion d’un portefeuille client.\\nDéveloppement de nouveaux produits et projets innovants.\\nGarantir le bon déroulement des formations, aussi bien à leur démarrage qu’à leur aboutissement.\\nParticiper au développement de marque via l’organisation de la communication et d’évènements locaux.",\n      "postCompatibility": "Haute"\n    },\n    {\n      "postTitle": "Assistant Commercial Export",\n      "postDate": "2016-2019",\n      "postCompany": "ORANGE, Paris",\n      "postContrat": "CDI",\n      "postDescription": "Assurer la mise à jour des coordonnées administrative relatives au compte client.\\nTraiter les demandes d’échantillon depuis la saisie jusqu’à l’expédition.\\nAssurer l\'interface entreprise-client export pour tout service sollicité.",\n      "postCompatibility": "Moyenne"\n    },\n    {\n      "postTitle": "Assistant Commercial Export",\n      "postDate": "2015",\n      "postCompany": "DANONE, Paris",\n      "postContrat": "Stage",\n      "postDescription": "Etablir des documents nécessaires à l\'expédition des commandes en fonction de son pays de destination, de l’incoterm ainsi que du mode de règlement convenu.\\nAssurer l\'accueil téléphonique des clients, fournisseurs et autres tiers.",\n      "postCompatibility": "Moyenne"\n    }\n  ],\n  "sections": [\n    {\n      "sectionTitle": "LANGUES",\n      "sectionContent": "Français\\nAnglais\\nEspagnol"\n    },\n    {\n      "sectionTitle": "COMPÉTENCES",\n      "sectionContent": "Sens du contact\\nCommunication\\nCapacité d’adaptation\\nPolyvalence\\nLogique\\nRigueur\\nAutonomie"\n    },\n    {\n      "sectionTitle": "CENTRES D’INTÉRÊT",\n      "sectionContent": "Triathlon\\nRandonnée\\nBénévolat\\nVoyage en sac à dos\\nThéâtre et concerts"\n    },\n    {\n      "sectionTitle": "FORMATION",\n      "sectionContent": "BTS Négociations et digitalisation relation client, Université Sorbonne, Paris | 2012 - 2015\\nLicence Pro Commerce et Distribution, ESUP, Paris | 2012 - 2015"\n    }\n  ]\n}\n```';

    const match = jsonResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      const jsonString = match[1];
      jsonData = JSON.parse(jsonString);
    }

    res.status(200).json({ jsonData });
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
  updateSectionInfoOrder,
  updateCvMinuteSectionOrder,
  deleteSectionInfo,
  deleteCvMinuteSection,
  openaiController,
};
