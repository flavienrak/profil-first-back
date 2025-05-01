import express from 'express';
import isEmpty from '../../../../utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { openai } from '../../../../socket';
import { AdviceInterface } from '../../../../interfaces/role/cv-minute/advice.interface';
import { CvMinuteSectionInterface } from '../../../../interfaces/role/cv-minute/cvMinuteSection.interface';
import { SectionInterface } from '../../../../interfaces/role/cv-minute/section.interface';
import { SectionInfoInterface } from '../../../../interfaces/role/cv-minute/sectionInfo.interface';
import { extractJson } from '../../../../utils/functions';

const prisma = new PrismaClient();

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
          postTitle: ${sectionInfo.title}, 
          postDate: ${sectionInfo.date}, 
          postDescription: ${sectionInfo.content}, 
        `;

        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
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
      (a) => a.type === 'advice',
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
        - Max 300 caractères.
        - Donne 1 à 3 propositions.
        - Donne directement les propositions sans contenu introductive ou explicative au format suivant : "XXXXXXXX : xxxxxxx,xxxxxx,xxxxxxx,xxxxxxxxx,xxxxxxxxx etc.." (pour infos : ("XXXX" = mot clé sexy pour le recruteur et "xxxxxx, xxxxx, xxxxx" = descriptions liés au mot clé):
        - Donne directement les propositions sans contenu introductive ou explicative.
        - Donne la réponse en json simple.
      `;

      messageUser = `Titre du poste: ${sectionInfo.title}\n Description actuelle : ${sectionInfo.content}\n Conseils : ${advice}\n Offre: ${cvMinute.position}`;
    }

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
      cvTitle: ${title.sectionInfos[0].content}, 
      profilePresentation: ${presentation.sectionInfos[0].content}, 
      experiences: ${experiences.sectionInfos.map((item, index) => `${index}. poste: ${item.title}, contrat: ${item.contrat}, description: ${item.content}`).join('\n')}, 
      ${allCvMinuteSections}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
      model: 'gpt-3.5-turbo',
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
