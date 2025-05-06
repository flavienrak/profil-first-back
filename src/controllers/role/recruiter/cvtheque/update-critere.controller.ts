import express from 'express';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { openai } from '@/socket';
import { extractJson } from '@/utils/functions';
import { cvThequesections } from '@/utils/constants';
import { cvThequePrompts } from '@/utils/prompts';
import { CvThequeCritereInterface } from '@/interfaces/role/recruiter/cvtheque/cvtheque-critere.interface';

const prisma = new PrismaClient();

const updateCvThequeCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    let updatedCvThequeCritere: CvThequeCritereInterface | null = null;
    let updatedCvThequeCritereId: number | null = Number(id);
    const body: {
      position?: string;
      description?: string;
      domain?: string;
      competences?: string[];
      experience?: number;
      diplome?: string;
      localisation?: string;
      distance?: number;
    } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvThequeViews: true,
        cvMinutes: {
          include: { cvMinuteSections: { include: { sectionInfos: true } } },
        },
      },
    });

    if (!cvThequeCritere) {
      return;
    }

    // Liste des champs textuels à comparer avec trim
    const textFields: (keyof Pick<
      typeof body,
      'position' | 'description' | 'diplome' | 'localisation'
    >)[] = ['position', 'description', 'diplome', 'localisation'];

    const valueFields: (keyof Pick<
      typeof body,
      'domain' | 'experience' | 'distance'
    >)[] = ['domain', 'experience', 'distance'];

    const modifiedFields: Record<string, any> = {};

    for (const field of textFields) {
      const newValue = body[field];
      if (newValue !== undefined) {
        const trimmed = newValue.trim();
        if (trimmed.length > 0 && trimmed !== cvThequeCritere[field]) {
          modifiedFields[field] = trimmed;
        }
      }
    }

    for (const field of valueFields) {
      const newValue = body[field];
      if (newValue !== undefined && newValue !== cvThequeCritere[field]) {
        modifiedFields[field] = newValue;
      }
    }

    if (cvThequeCritere.saved) {
      // CREATE COPY
      const data = {
        position: cvThequeCritere.position,
        domain: cvThequeCritere.domain,
        description: cvThequeCritere.description,
        diplome: cvThequeCritere.diplome,
        localisation: cvThequeCritere.localisation,
        distance: cvThequeCritere.distance,
        experience: cvThequeCritere.experience,
        ...modifiedFields,
        evaluation: cvThequeCritere.evaluation,
        userId: cvThequeCritere.userId,
      };

      const newCvThequeCritere = await prisma.cvThequeCritere.create({ data });
      updatedCvThequeCritereId = newCvThequeCritere.id;

      // COPY CVTHEQUE COMPETENCES
      if (body.competences && body.competences.length > 0) {
        const trimmedCompetences = body.competences
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        for (const item of trimmedCompetences) {
          await prisma.cvThequeCompetence.create({
            data: {
              content: item,
              cvThequeCritereId: newCvThequeCritere.id,
            },
          });
        }
      }

      // COPY CVTHEUQUE USERS
      for (const item of cvThequeCritere.cvThequeUsers) {
        await prisma.cvThequeUser.create({
          data: {
            score: item.score,
            userId: item.userId,
            cvThequeCritereId: newCvThequeCritere.id,
          },
        });
      }

      // COPY CVTHEUQUE VIEWS
      for (const item of cvThequeCritere.cvThequeViews) {
        await prisma.cvThequeView.create({
          data: {
            count: item.count,
            cvMinuteId: item.cvMinuteId,
            cvThequeCritereId: newCvThequeCritere.id,
          },
        });
      }

      // COPY CVMINUTES
      for (const item of cvThequeCritere.cvMinutes) {
        const newCvMinute = await prisma.cvMinute.create({
          data: {
            position: item.position,
            name: item.name,
            primaryBg: item.primaryBg,
            secondaryBg: item.secondaryBg,
            tertiaryBg: item.tertiaryBg,
            visible: item.visible,
            generated: item.generated,
            userId: item.userId,
            cvThequeCritereId: newCvThequeCritere.id,
          },
        });

        await Promise.all(
          item.cvMinuteSections.map(async (section) => {
            const newCvMinuteSection = await prisma.cvMinuteSection.create({
              data: {
                cvMinuteId: newCvMinute.id,
                sectionId: section.sectionId,
                sectionOrder: section.sectionOrder,
                sectionTitle: section.sectionTitle,
              },
            });

            await Promise.all(
              section.sectionInfos.map(async (info) => {
                await prisma.sectionInfo.create({
                  data: {
                    cvMinuteSectionId: newCvMinuteSection.id,
                    title: info.title,
                    content: info.content,
                    date: info.date,
                    company: info.company,
                    contrat: info.contrat,
                    icon: info.icon,
                    iconSize: info.iconSize,
                    order: info.order,
                  },
                });
              }),
            );
          }),
        );
      }
    } else {
      // Mise à jour des critères simples si changement
      if (Object.keys(modifiedFields).length > 0) {
        await prisma.cvThequeCritere.update({
          where: { id: cvThequeCritere.id },
          data: modifiedFields,
        });
      }

      if (body.competences && body.competences.length > 0) {
        const trimmedCompetences = body.competences
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        const existing = await prisma.cvThequeCompetence.findMany({
          where: { cvThequeCritereId: cvThequeCritere.id },
        });

        const existingContents = existing.map((e) => e.content);

        const toDelete = existing.filter(
          (e) => !trimmedCompetences.includes(e.content),
        );

        for (const item of toDelete) {
          await prisma.cvThequeCompetence.delete({ where: { id: item.id } });
        }

        for (const c of trimmedCompetences) {
          if (!existingContents.includes(c)) {
            await prisma.cvThequeCompetence.create({
              data: {
                cvThequeCritereId: cvThequeCritere.id,
                content: c,
              },
            });
          }
        }
      }
    }

    if (updatedCvThequeCritereId !== cvThequeCritere.id) {
      updatedCvThequeCritere = await prisma.cvThequeCritere.findUnique({
        where: { id: updatedCvThequeCritereId },
        include: {
          cvThequeCompetences: true,
          cvThequeUsers: true,
          cvThequeViews: true,
          cvMinutes: {
            include: { cvMinuteSections: { include: { sectionInfos: true } } },
          },
        },
      });
    }

    if (!updatedCvThequeCritere) {
      return;
    }

    const users = await prisma.user.findMany({
      where: { role: 'user' },
      include: {
        cvMinutes: {
          include: { cvMinuteSections: { include: { sectionInfos: true } } },
        },
      },
    });

    const lines = [`intitulé : ${updatedCvThequeCritere.position}`];

    if (updatedCvThequeCritere.description) {
      lines.push(`description : ${updatedCvThequeCritere.description}`);
    }

    if (
      updatedCvThequeCritere.cvThequeCompetences &&
      updatedCvThequeCritere.cvThequeCompetences.length > 0
    ) {
      const competences = updatedCvThequeCritere.cvThequeCompetences
        .map((c) => c.content)
        .join('\n');
      lines.push(`compétences : ${competences}`);
    }

    if (updatedCvThequeCritere.experience) {
      lines.push(`années d'expérience : ${updatedCvThequeCritere.experience}`);
    }

    if (updatedCvThequeCritere.diplome) {
      lines.push(`niveau de diplôme : ${updatedCvThequeCritere.diplome}`);
    }

    if (updatedCvThequeCritere.localisation) {
      lines.push(`localisation : ${updatedCvThequeCritere.localisation}`);
    }

    if (updatedCvThequeCritere.distance) {
      lines.push(`rayon : ${updatedCvThequeCritere.distance}km`);
    }

    const position = lines.join('\n');

    for (const u of users) {
      if (u.cvMinutes.length > 0) {
        let cvMinute = null;
        let maxExperienceCount = 0;

        for (const c of u.cvMinutes) {
          const sections = await prisma.section.findMany({
            where: {
              id: {
                in: c.cvMinuteSections.map((section) => section.sectionId),
              },
            },
          });

          const getCvMinuteSection = (value: string) => {
            const section = sections.find(
              (s) => s.name.toLowerCase() === value.toLowerCase(),
            );
            return c.cvMinuteSections.find((s) => s.sectionId === section?.id);
          };

          const experiences = getCvMinuteSection('experiences');

          if (
            experiences &&
            experiences.sectionInfos.length > maxExperienceCount
          ) {
            maxExperienceCount = experiences.sectionInfos.length;
            cvMinute = c;
          }
        }

        if (cvMinute) {
          const sections = await prisma.section.findMany({
            where: {
              id: {
                in: cvMinute.cvMinuteSections.map(
                  (section) => section.sectionId,
                ),
              },
            },
          });

          const getCvMinuteSection = (value: string) => {
            const section = sections.find(
              (s) => s.name.toLowerCase() === value.toLowerCase(),
            );
            return cvMinute.cvMinuteSections.find(
              (s) => s.sectionId === section?.id,
            );
          };

          const experiences = getCvMinuteSection('experiences');

          if (experiences && experiences.sectionInfos.length > 0) {
            let messageContent = '';
            const editableSections = sections.filter((s) => s.editable);
            const allCvMinuteSections = editableSections
              .map((s) => {
                const cvMinuteSection = getCvMinuteSection(s.name);
                if (cvMinuteSection) {
                  return `${cvMinuteSection.sectionTitle} : ${cvMinuteSection.sectionInfos[0].content}`;
                }
                return null;
              })
              .filter((r) => r)
              .join('\n');

            if (u.qualiCarriere === 'active') {
              const qualiCarriereResumes =
                await prisma.qualiCarriereResume.findMany({
                  where: { userId: u.id },
                });

              messageContent = `
                  Contenus du CV :\n
                  Expériences : 
                  ${experiences.sectionInfos
                    .map(
                      (item) =>
                        `${item.date}, ${item.company}, ${item.title} : ${item.content}, synthèse : ${qualiCarriereResumes.find((r) => r.sectionInfoId === item.id)?.content}`,
                    )
                    .join('\n')}\n
                  Sections : ${allCvMinuteSections}\n
                  Offre ciblée : ${position}
                `;
            } else {
              messageContent = `
                  Contenus du CV :\n
                  Expériences : 
                  ${experiences.sectionInfos
                    .map(
                      (item) =>
                        `${item.date}, ${item.company}, ${item.title} : ${item.content}`,
                    )
                    .join('\n')}\n
                  Sections : ${allCvMinuteSections}\n
                  Offre ciblée : ${position}
                `;
            }

            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: `
                      Tu es expert en rédaction de CV et en analyse d’adéquation avec les offres d’emploi.

                      Mission :
                      À partir du contenu du CV et de l’offre ciblée, évaluer la compatibilité entre le contenu du CV et l'offre ciblée, en attribuant un score de 0 à 100.
  
                      Règles de compatibilité :
                      - Si le score est strictement supérieur à 50, considérer le CV comme compatible.
                      - Sinon, considérer comme non compatible.

                      Contraintes :
                      - Ne jamais sortir du format demandé.
  
                      Format attendu :
                      {
                        "compatible": "true" ou "false",
                        "score": "valeur entre 0 et 100"
                      }
                    `.trim(),
                },
                {
                  role: 'user',
                  content: messageContent.trim(),
                },
              ],
            });

            if (openaiResponse.id) {
              for (const r of openaiResponse.choices) {
                await prisma.openaiResponse.create({
                  data: {
                    responseId: openaiResponse.id,
                    userId: u.id,
                    request: 'cvtheque-evaluation',
                    response:
                      r.message.content ?? 'cvtheque-evaluation-response',
                    index: r.index,
                  },
                });

                const jsonData: { compatible: boolean; score: number } =
                  extractJson(r.message.content);

                if (!jsonData) {
                  res.json({ parsingError: true });
                  return;
                }

                if (jsonData.compatible) {
                  const existCvThequeUser =
                    await prisma.cvThequeUser.findUnique({
                      where: {
                        userId_cvThequeCritereId: {
                          userId: u.id,
                          cvThequeCritereId: updatedCvThequeCritere.id,
                        },
                      },
                    });

                  if (!existCvThequeUser) {
                    await prisma.cvThequeUser.create({
                      data: {
                        score: jsonData.score,
                        userId: u.id,
                        cvThequeCritereId: updatedCvThequeCritere.id,
                      },
                    });
                  }

                  const cvMinuteCount = await prisma.cvMinute.count({
                    where: { cvThequeCritereId: updatedCvThequeCritere.id },
                  });

                  const name = `Profil First ${cvMinuteCount + 1}`;

                  const newCvMinute = await prisma.cvMinute.create({
                    data: {
                      name,
                      userId: u.id,
                      position: updatedCvThequeCritere.position,
                      cvThequeCritereId: updatedCvThequeCritere.id,
                      generated:
                        u.qualiCarriere === 'active' ? 'dynamic' : 'static',
                    },
                  });

                  for (const s of cvThequesections) {
                    let section = await prisma.section.findUnique({
                      where: { name: s.name.trim().toLowerCase() },
                    });

                    if (!section) {
                      section = await prisma.section.create({
                        data: {
                          name: s.name.trim().toLowerCase(),
                          editable: true,
                        },
                      });
                    }

                    const cvMinuteSection = await prisma.cvMinuteSection.create(
                      {
                        data: {
                          cvMinuteId: newCvMinute.id,
                          sectionId: section.id,
                          sectionOrder: s.order,
                          sectionTitle: s.name.trim(),
                        },
                      },
                    );

                    if (s.name === 'title') {
                      // TITLE
                      const openaiSectionResponse =
                        await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo',
                          messages: [
                            {
                              role: 'system',
                              content:
                                cvThequePrompts[
                                  (updatedCvThequeCritere.evaluation + 1) % 3
                                ][s.name].trim(),
                            },
                            {
                              role: 'user',
                              content: messageContent.trim(),
                            },
                          ],
                        });

                      if (openaiSectionResponse.id) {
                        for (const r of openaiSectionResponse.choices) {
                          await prisma.openaiResponse.create({
                            data: {
                              responseId: openaiSectionResponse.id,
                              userId: u.id,
                              request: 'cvtheque-title',
                              response:
                                r.message.content ?? 'cvtheque-title-response',
                              index: r.index,
                            },
                          });

                          const jsonData: { content: string } = extractJson(
                            r.message.content,
                          );

                          if (!jsonData) {
                            res.json({ parsingError: true });
                            return;
                          }

                          await prisma.sectionInfo.create({
                            data: {
                              cvMinuteSectionId: cvMinuteSection.id,
                              content: jsonData.content,
                            },
                          });
                        }
                      }
                    } else if (s.name === 'presentation') {
                      // PRESENTATION
                      const openaiSectionResponse =
                        await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo',
                          messages: [
                            {
                              role: 'system',
                              content:
                                cvThequePrompts[
                                  (updatedCvThequeCritere.evaluation + 1) % 3
                                ][s.name].trim(),
                            },
                            {
                              role: 'user',
                              content: messageContent.trim(),
                            },
                          ],
                        });

                      if (openaiSectionResponse.id) {
                        for (const r of openaiSectionResponse.choices) {
                          await prisma.openaiResponse.create({
                            data: {
                              responseId: openaiSectionResponse.id,
                              userId: u.id,
                              request: 'cvtheque-presentation',
                              response:
                                r.message.content ??
                                'cvtheque-presentation-response',
                              index: r.index,
                            },
                          });

                          const jsonData: { content: string } = extractJson(
                            r.message.content,
                          );

                          if (!jsonData) {
                            res.json({ parsingError: true });
                            return;
                          }

                          await prisma.sectionInfo.create({
                            data: {
                              cvMinuteSectionId: cvMinuteSection.id,
                              content: jsonData.content,
                            },
                          });
                        }
                      }
                    } else if (s.name === 'experiences') {
                      // EXPERIENCES
                      const openaiSectionResponse =
                        await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo',
                          messages: [
                            {
                              role: 'system',
                              content:
                                cvThequePrompts[
                                  (updatedCvThequeCritere.evaluation + 1) % 3
                                ][s.name].trim(),
                            },
                            {
                              role: 'user',
                              content: messageContent.trim(),
                            },
                          ],
                        });

                      if (openaiSectionResponse.id) {
                        for (const r of openaiSectionResponse.choices) {
                          await prisma.openaiResponse.create({
                            data: {
                              responseId: openaiSectionResponse.id,
                              userId: u.id,
                              request: 'cvtheque-experience',
                              response:
                                r.message.content ??
                                'cvtheque-experience-response',
                              index: r.index,
                            },
                          });
                          const jsonData: {
                            title: string;
                            date: string;
                            company: string;
                            description: string;
                          }[] = extractJson(r.message.content);

                          if (!jsonData) {
                            res.json({ parsingError: true });
                            return;
                          }

                          for (let i = 0; i < jsonData.length; i++) {
                            const item = jsonData[i];
                            await prisma.sectionInfo.create({
                              data: {
                                cvMinuteSectionId: cvMinuteSection.id,
                                title: item.title,
                                content: item.description,
                                date: item.date,
                                company: item.company,
                                order: i + 1,
                              },
                            });
                          }
                        }
                      }
                    } else if (s.name === 'diplomes') {
                      // DIPLOMES
                      const openaiSectionResponse =
                        await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo',
                          messages: [
                            {
                              role: 'system',
                              content:
                                cvThequePrompts[
                                  (updatedCvThequeCritere.evaluation + 1) % 3
                                ][s.name].trim(),
                            },
                            {
                              role: 'user',
                              content: messageContent.trim(),
                            },
                          ],
                        });

                      if (openaiSectionResponse.id) {
                        for (const r of openaiSectionResponse.choices) {
                          await prisma.openaiResponse.create({
                            data: {
                              responseId: openaiSectionResponse.id,
                              userId: u.id,
                              request: 'cvtheque-diplomes',
                              response:
                                r.message.content ??
                                'cvtheque-diplomes-response',
                              index: r.index,
                            },
                          });

                          const jsonData: { content: string } = extractJson(
                            r.message.content,
                          );

                          if (!jsonData) {
                            res.json({ parsingError: true });
                            return;
                          }

                          await prisma.sectionInfo.create({
                            data: {
                              cvMinuteSectionId: cvMinuteSection.id,
                              content: jsonData.content,
                            },
                          });
                        }
                      }
                    } else if (s.name === 'formation') {
                      // FORMATION
                      const openaiSectionResponse =
                        await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo',
                          messages: [
                            {
                              role: 'system',
                              content:
                                cvThequePrompts[
                                  (updatedCvThequeCritere.evaluation + 1) % 3
                                ][s.name].trim(),
                            },
                            {
                              role: 'user',
                              content: messageContent.trim(),
                            },
                          ],
                        });

                      if (openaiSectionResponse.id) {
                        for (const r of openaiSectionResponse.choices) {
                          await prisma.openaiResponse.create({
                            data: {
                              responseId: openaiSectionResponse.id,
                              userId: u.id,
                              request: 'cvtheque-formation',
                              response:
                                r.message.content ??
                                'cvtheque-formation-response',
                              index: r.index,
                            },
                          });

                          const jsonData: { content: string } = extractJson(
                            r.message.content,
                          );

                          if (!jsonData) {
                            res.json({ parsingError: true });
                            return;
                          }

                          await prisma.sectionInfo.create({
                            data: {
                              cvMinuteSectionId: cvMinuteSection.id,
                              content: jsonData.content,
                            },
                          });
                        }
                      }
                    } else if (s.name === 'competence') {
                      // COMPETENCE
                      const openaiSectionResponse =
                        await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo',
                          messages: [
                            {
                              role: 'system',
                              content:
                                cvThequePrompts[
                                  (updatedCvThequeCritere.evaluation + 1) % 3
                                ][s.name].trim(),
                            },
                            {
                              role: 'user',
                              content: messageContent.trim(),
                            },
                          ],
                        });

                      if (openaiSectionResponse.id) {
                        for (const r of openaiSectionResponse.choices) {
                          await prisma.openaiResponse.create({
                            data: {
                              responseId: openaiSectionResponse.id,
                              userId: u.id,
                              request: 'cvtheque-competence',
                              response:
                                r.message.content ??
                                'cvtheque-competence-response',
                              index: r.index,
                            },
                          });

                          const jsonData: { content: string } = extractJson(
                            r.message.content,
                          );

                          if (!jsonData) {
                            res.json({ parsingError: true });
                            return;
                          }

                          await prisma.sectionInfo.create({
                            data: {
                              cvMinuteSectionId: cvMinuteSection.id,
                              content: jsonData.content,
                            },
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    updatedCvThequeCritere = await prisma.cvThequeCritere.update({
      where: { id: updatedCvThequeCritere.id },
      data: { evaluation: { increment: 1 } },
    });

    updatedCvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: updatedCvThequeCritere.id },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvThequeViews: true,
        cvMinutes: true,
      },
    });

    res.status(200).json({ cvThequeCritere: updatedCvThequeCritere });
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

export { updateCvThequeCritere };
