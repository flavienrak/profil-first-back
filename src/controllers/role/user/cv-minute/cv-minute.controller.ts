import express from 'express';
import isEmpty from '../../../../utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { openai } from '../../../../socket';
import { extractJson } from '../../../../utils/functions';
import { SectionInterface } from '../../../../interfaces/role/user/cv-minute/section.interface';
import { CvMinuteSectionInterface } from '../../../../interfaces/role/user/cv-minute/cvMinuteSection.interface';
import { SectionInfoInterface } from '../../../../interfaces/role/user/cv-minute/sectionInfo.interface';
import { EvaluationInterface } from '../../../../interfaces/role/user/cv-minute/evaluation.interface';

const prisma = new PrismaClient();

const updateCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let section: SectionInterface = null;
    let cvMinuteSection: CvMinuteSectionInterface = null;
    let sectionInfo: SectionInfoInterface = null;

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

      res.status(200).json({
        cvMinute: {
          primaryBg: updatedCvMinute.primaryBg,
          secondaryBg: updatedCvMinute.secondaryBg,
          tertiaryBg: updatedCvMinute.tertiaryBg,
        },
      });
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
          postTitle : ${sectionInfo.title}, 
          postDate : ${sectionInfo.date}, 
          postDescription : ${sectionInfo.content}, 
        `;

        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `
                Tu es expert en évaluation de CV.

                Objectif :
                Évalue la compatibilité entre une expérience professionnelle et une offre d’emploi.

                Données attendues (en JSON simple) :
                {
                  postScore: string, // Score sur 100 mesurant l'adéquation
                  postHigh: string,  // 1 à 3 phrases sur les points forts (chaque phrase sur une nouvelle ligne)
                  postWeak: string   // 1 à 3 phrases sur les axes d'amélioration (chaque phrase sur une nouvelle ligne)
                }

                Règles :
                - Le score est une valeur entière entre 0 et 100.
                - Les commentaires doivent être clairs, constructifs et basés sur les attentes du poste.
                - Pas d’introduction ni de phrase hors sujet.
              `.trim(),
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
                request: 'evaluation',
                response: r.message.content,
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
        return cvMinuteSection.sectionTitle;
      })
      .join(', ');

    const advice = cvMinute.advices.find((a) => a.type === 'advice');

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
            Tu es expert en rédaction de CV.

            Objectif :
            Proposer entre 1 et 3 sections supplémentaires pour enrichir un CV existant, en fonction :
            - de l'offre d’emploi ciblée
            - des conseils fournis

            Contraintes :
            - Ne pas proposer les sections déjà présentes.
            - Suggérer uniquement des ajouts pertinents, concrets et orientés impact.

            Format attendu (JSON simple) :
            { sections: ["Nom de la section 1", "Nom de la section 2"] }
          `.trim(),
        },
        {
          role: 'user',
          content: `
            Sections existantes :\n${allCvMinuteSections}\n
            Conseils :\n${advice.content}\n
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
            request: 'advice',
            response: r.message.content,
            index: r.index,
          },
        });

        const jsonData: { sections: string[] } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

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
    let messageSystem: string = null;
    let messageUser: string = null;
    const { cvMinute } = res.locals;
    const { sectionInfoId } = req.params;
    const body: { section: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

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
      messageSystem = `
        Tu es expert en optimisation de CV.

        Objectif : Proposer 1 à 3 titres de CV adaptés à l’offre et aux conseils fournis.

        Format attendu :
        { advices: ["Titre 1", "Titre 2", "Titre 3"] }

        Contraintes :
        - Pas de phrases explicatives
        - Max 80 caractères par titre
        - JSON simple uniquement
      `;

      messageUser = `
        Titre actuel :
        ${sectionInfo.content}\n
        Conseils : ${advice}\n
        Offre: ${cvMinute.position}
      `;
    } else if (body.section === 'presentation') {
      messageSystem = `
        Tu es expert en rédaction de CV.

        Objectif : Suggérer 1 à 3 présentations de profil percutantes, selon l’offre et les conseils.

        Format attendu :
        { advices: ["Proposition 1", "Proposition 2"] }

        Contraintes :
        - Réponses claires, sans introduction
        - JSON simple uniquement
      `;

      messageUser = `
        Présentation actuelle : 
        ${sectionInfo.content}\n 
        Conseils :\n${advice} \n 
        Offre: ${cvMinute.position}
      `;
    } else if (body.section === 'experience') {
      messageSystem = `
        Tu es expert en rédaction de CV.

        Objectif : Proposer 1 à 3 enrichissements à ajouter à une expérience, selon les conseils et l’offre.

        Format attendu :
        { advices: ["MotClé : détail1, détail2, détail3", "..."] }

        Contraintes :
        - Max 300 caractères par ligne
        - Pas de phrases explicatives
        - Format : "MotClé : détail1, détail2..."
        - JSON simple uniquement
      `;

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
            request: 'advice',
            response: r.message.content,
            index: r.index,
          },
        });

        const jsonData: { advices: string[] } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

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
    let evaluation: EvaluationInterface = null;
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
        return `${cvMinuteSection.sectionTitle}: ${cvMinuteSection.sectionInfos[0].content}`;
      })
      .join('\n');

    const cvDetails = `
      cvTitle : ${title.sectionInfos[0].content}, 
      profilePresentation : ${presentation.sectionInfos[0].content}, 
      experiences : ${experiences.sectionInfos.map((item, index) => `${index}. poste : ${item.title}, contrat : ${item.contrat}, description : ${item.content}`).join('\n')}, 
      sections : ${allCvMinuteSections}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
            Tu es expert en rédaction et optimisation de CV.

            Objectif :
            Évaluer la compatibilité globale du CV avec l’offre et fournir des recommandations concrètes.

            Format attendu :
            {
              globalScore: number, // Score de compatibilité de 0 à 100
              recommendations: string // 1 à 3 phrases, séparées par des sauts de ligne
            }

            Contraintes :
            - JSON simple uniquement
            - Pas de texte explicatif en dehors du format demandé
          `.trim(),
        },
        {
          role: 'user',
          content: `
            Contenu du CV : ${cvDetails}\n 
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
            request: 'matching-score',
            response: r.message.content,
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
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSectionInfoScore = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let evaluation: EvaluationInterface = null;
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
          content: `
            Tu es expert en rédaction et optimisation de CV.

            Objectif :
            Évaluer la compatibilité entre une expérience professionnelle et une offre d’emploi.

            Format attendu :
            {
              score: number,         // Score de compatibilité de 0 à 100
              postHigh: string,      // 1 à 3 phrases sur les points forts (une phrase par ligne)
              postWeak: string       // 1 à 3 phrases sur les axes d'amélioration (une phrase par ligne)
            }

            Contraintes :
            - JSON simple uniquement
            - Chaque phrase explicative sur une nouvelle ligne
            - Pas de texte hors format JSON
          `.trim(),
        },
        {
          role: 'user',
          content: `
            Contenu de l'expérience : 
            ${experience}\n 
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
            request: 'matching-score',
            response: r.message.content,
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
    res.status(500).json({ error: `${error.message}` });
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
