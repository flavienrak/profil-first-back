import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { extractJson, formatTextWithStrong } from '@/utils/functions';
import { cvThequesections, maxCvThequeUserResult } from '@/utils/constants';
import {
  cvThequeCirterePrompts,
  cvThequeUserEvaluationPrompt,
} from '@/utils/prompts/cvtheque.prompt';
import { CvThequeCritereInterface } from '@/interfaces/role/recruiter/cvtheque/cvthequeCritere.interface';
import { CvMinuteInterface } from '@/interfaces/role/candidat/cv-minute/cvMinute.interface';
import { CompatibleUserInterface } from '@/interfaces/role/recruiter/cvtheque/compatibleUser.interface';
import { gpt3 } from '@/utils/openai';

const updateCvThequeCritere = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    let updatedCvThequeCritere: CvThequeCritereInterface | null = null;
    const body = req.body as {
      position?: string;
      description?: string;
      domain?: string;
      competences?: string[];
      experience?: number;
      diplome?: string;
      localisation?: string;
      distance?: number;
    };

    const cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvThequeViews: true,
        cvMinutes: {
          include: {
            cvThequeContacts: true,
            cvMinuteSections: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!cvThequeCritere) {
      return;
    }

    let updatedCvThequeCritereId: number | null = Number(cvThequeCritere.id);

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

        await prisma.cvThequeCompetence.createMany({
          data: trimmedCompetences.map((item) => ({
            content: item,
            cvThequeCritereId: newCvThequeCritere.id,
          })),
        });
      }

      // COPY CVTHEUQUE USERS
      if (cvThequeCritere.cvThequeUsers.length > 0) {
        await prisma.cvThequeUser.createMany({
          data: cvThequeCritere.cvThequeUsers.map((item) => ({
            score: item.score,
            userId: item.userId,
            cvThequeCritereId: newCvThequeCritere.id,
          })),
        });
      }

      // COPY CVTHEUQUE VIEWS
      if (cvThequeCritere.cvThequeViews.length > 0) {
        await prisma.cvThequeView.createMany({
          data: cvThequeCritere.cvThequeViews.map((item) => ({
            count: item.count,
            cvMinuteId: item.cvMinuteId,
            cvThequeCritereId: newCvThequeCritere.id,
          })),
        });
      }

      // COPY CVMINUTES
      await Promise.all(
        cvThequeCritere.cvMinutes.map(async (item) => {
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

          // COPY CVMINUTE SECTIONS
          if (item.cvMinuteSections.length > 0) {
            await prisma.cvMinuteSection.createMany({
              data: item.cvMinuteSections.map((info) => ({
                name: info.name,
                title: info.title,
                content: info.content,
                date: info.date,
                company: info.company,
                contrat: info.contrat,
                icon: info.icon,
                iconSize: info.iconSize,
                order: info.order,
                cvMinuteId: newCvMinute.id,
              })),
            });
          }

          // COPY CVTHEQUE CONTACTS
          if (item.cvThequeContacts.length > 0) {
            await prisma.cvThequeContact.createMany({
              data: item.cvThequeContacts.map((info) => ({
                type: info.type,
                date: info.date,
                hour: info.hour,
                minute: info.minute,
                message: info.message,
                status: info.status,
                userId: info.userId,
                recruiterId: info.recruiterId,
                cvMinuteId: newCvMinute.id,
              })),
            });
          }
        }),
      );
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

        await Promise.all(
          toDelete.map(async (item) => {
            await prisma.cvThequeCompetence.delete({ where: { id: item.id } });
          }),
        );

        await Promise.all(
          trimmedCompetences.map(async (item) => {
            if (!existingContents.includes(item)) {
              await prisma.cvThequeCompetence.create({
                data: {
                  cvThequeCritereId: cvThequeCritere.id,
                  content: item,
                },
              });
            }
          }),
        );
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
            include: { cvMinuteSections: { orderBy: { order: 'desc' } } },
          },
        },
      });
    }

    if (!updatedCvThequeCritere) {
      res.json({ cvThequeCritereNotFound: true });
      return;
    }

    const users = await prisma.user.findMany({
      where: { role: 'user' },
      include: {
        cvMinuteDomains: true,
        cvMinutes: {
          include: { cvMinuteSections: { orderBy: { order: 'desc' } } },
        },
      },
    });

    const lines = [`intitulé: ${updatedCvThequeCritere.position}`];

    if (updatedCvThequeCritere.description) {
      lines.push(`description: ${updatedCvThequeCritere.description}`);
    }

    if (
      updatedCvThequeCritere.cvThequeCompetences &&
      updatedCvThequeCritere.cvThequeCompetences.length > 0
    ) {
      const competences = updatedCvThequeCritere.cvThequeCompetences
        .map((c) => c.content)
        .join('\n');
      lines.push(`compétences: ${competences}`);
    }

    if (updatedCvThequeCritere.experience) {
      lines.push(`années d'expérience: ${updatedCvThequeCritere.experience}`);
    }

    if (updatedCvThequeCritere.diplome) {
      lines.push(`niveau de diplôme: ${updatedCvThequeCritere.diplome}`);
    }

    if (updatedCvThequeCritere.localisation) {
      lines.push(`localisation: ${updatedCvThequeCritere.localisation}`);
    }

    if (updatedCvThequeCritere.distance) {
      lines.push(`rayon: ${updatedCvThequeCritere.distance}km`);
    }

    const position = lines.join('\n');

    const cvThequeUsers = await prisma.cvThequeUser.findMany({
      where: { cvThequeCritereId: cvThequeCritere.id },
    });
    const takenIds = new Set(cvThequeUsers.map((c) => c.userId));

    const compatibleUsers: CompatibleUserInterface[] = [];
    let addedInLastCycle = true;

    while (compatibleUsers.length < maxCvThequeUserResult && addedInLastCycle) {
      addedInLastCycle = false;

      for (const u of users) {
        if (compatibleUsers.length >= maxCvThequeUserResult) break;

        if (
          !takenIds.has(u.id) &&
          u.cvMinutes &&
          u.cvMinutes.length > 0 &&
          u.cvMinuteDomains &&
          u.cvMinuteDomains.length > 0 &&
          u.cvMinuteDomains
            .map((item) => item.content)
            .includes(cvThequeCritere.domain)
        ) {
          const cvMinuteIds = u.cvMinuteDomains.map((item) => item.cvMinuteId);
          const cvMinutes = u.cvMinutes.filter((item) =>
            cvMinuteIds.includes(item.id),
          );

          if (cvMinutes.length > 0) {
            let cvMinute: CvMinuteInterface | null = null;
            let maxExperienceCount = 0;

            for (const c of cvMinutes) {
              const experiences = c.cvMinuteSections?.filter(
                (c) => c.name === 'experiences',
              );

              if (experiences && experiences.length > maxExperienceCount) {
                maxExperienceCount = experiences.length;
                cvMinute = c;
              }
            }

            if (cvMinute) {
              const experiences = cvMinute.cvMinuteSections?.filter(
                (c) => c.name === 'experiences',
              );

              if (experiences && experiences.length > 0) {
                let messageContent = '';
                const editableSections = experiences.filter((s) => s.editable);
                const allCvMinuteSections = editableSections
                  .map(
                    (s) =>
                      `sectionName: ${s.name}, sectionContent: ${s.content}`,
                  )
                  .filter((r) => r)
                  .join('\n');

                if (u.qualiCarriere === 'active') {
                  const qualiCarriereResumes =
                    await prisma.qualiCarriereResume.findMany({
                      where: { userId: u.id },
                    });

                  messageContent = `
                    Contenus du CV:\n
                    Expériences: 
                    ${experiences
                      .map(
                        (item) =>
                          `postDate: ${item.date}, 
                           postCompany: ${item.company}, 
                           postTitle: ${item.title}, 
                           postDescription: ${item.content}, 
                           postSynthèse: ${qualiCarriereResumes.find((r) => r.cvMinuteSectionId === item.id)?.content}`,
                      )
                      .join('\n')}\n
                    Sections: ${allCvMinuteSections}\n
                    Offre ciblée: ${position}
                  `;
                } else {
                  messageContent = `
                    Contenus du CV:\n
                    Expériences: 
                    ${experiences
                      .map(
                        (item) =>
                          `postDate: ${item.date}, 
                           postCompany: ${item.company}, 
                           postTitle: ${item.title}, 
                           postDescription: ${item.content}`,
                      )
                      .join('\n')}\n
                    Sections: ${allCvMinuteSections}\n
                    Offre ciblée: ${position}
                  `;
                }

                const openaiResponse = await gpt3([
                  {
                    role: 'system',
                    content: cvThequeUserEvaluationPrompt.trim(),
                  },
                  {
                    role: 'user',
                    content: messageContent.trim(),
                  },
                ]);

                if ('error' in openaiResponse) {
                  res.json({ openaiError: openaiResponse.error });
                  return;
                }

                for (const r of openaiResponse.choices) {
                  await prisma.openaiResponse.create({
                    data: {
                      responseId: openaiResponse.id,
                      userId: u.id,
                      request: 'cvthequeEvaluation',
                      response: r.message.content ?? '',
                      index: r.index,
                    },
                  });

                  const jsonData: {
                    compatible: boolean;
                    score: number;
                  } = extractJson(r.message.content);

                  if (!jsonData) {
                    res.json({ parsingError: true });
                    return;
                  }

                  if (Boolean(jsonData.compatible)) {
                    const existCvThequeUser =
                      await prisma.cvThequeUser.findUnique({
                        where: {
                          userId_cvThequeCritereId: {
                            userId: u.id,
                            cvThequeCritereId: cvThequeCritere.id,
                          },
                        },
                      });

                    if (!existCvThequeUser) {
                      await prisma.cvThequeUser.create({
                        data: {
                          score: Number(jsonData.score),
                          userId: u.id,
                          cvThequeCritereId: cvThequeCritere.id,
                        },
                      });
                    }

                    takenIds.add(u.id);
                    compatibleUsers.push({
                      score: jsonData.score,
                      user: u,
                      messageContent,
                    });
                    addedInLastCycle = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    const orderedUsers = compatibleUsers.sort((a, b) => b.score - a.score);
    const allUsers: ({
      index: number;
    } & CompatibleUserInterface)[] = [];

    for (
      let i = maxCvThequeUserResult * cvThequeCritere.evaluation;
      i < maxCvThequeUserResult * (cvThequeCritere.evaluation + 1);
      i++
    ) {
      const item = orderedUsers[i % orderedUsers.length];
      const loopIndex = Math.floor(i / orderedUsers.length);
      allUsers.push({ ...item, index: loopIndex });
    }

    for (const item of allUsers) {
      const cvMinuteCount = await prisma.cvMinute.count({
        where: {
          cvThequeCritereId: cvThequeCritere.id,
        },
      });

      const name = `Profil First ${cvMinuteCount + 1}`;

      const newCvMinute = await prisma.cvMinute.create({
        data: {
          name,
          score: item.score,
          position: cvThequeCritere.position,
          userId: item.user.id,
          cvThequeCritereId: cvThequeCritere.id,
          generated:
            item.user.qualiCarriere === 'active' ? 'dynamic' : 'static',
        },
      });

      for (const s of cvThequesections) {
        if (s.name === 'title') {
          // TITLE
          const openaiSectionResponse = await gpt3([
            {
              role: 'system',
              content: cvThequeCirterePrompts[item.index % 3][s.name].trim(),
            },
            {
              role: 'user',
              content: item.messageContent.trim(),
            },
          ]);

          if ('error' in openaiSectionResponse) {
            res.json({ openaiError: openaiSectionResponse.error });
            return;
          }

          for (const r of openaiSectionResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiSectionResponse.id,
                userId: item.user.id,
                request: 'cvthequeTitle',
                response: r.message.content ?? '',
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

            await prisma.cvMinuteSection.create({
              data: {
                order: Number(s.order),
                name: s.name.trim(),
                content: jsonData.content,
                cvMinuteId: newCvMinute.id,
              },
            });
          }
        } else if (s.name === 'presentation') {
          // PRESENTATION
          const openaiSectionResponse = await gpt3([
            {
              role: 'system',
              content: cvThequeCirterePrompts[item.index % 3][s.name].trim(),
            },
            {
              role: 'user',
              content: item.messageContent.trim(),
            },
          ]);

          if ('error' in openaiSectionResponse) {
            res.json({ openaiError: openaiSectionResponse.error });
            return;
          }

          for (const r of openaiSectionResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiSectionResponse.id,
                userId: item.user.id,
                request: 'cvthequePresentation',
                response: r.message.content ?? '',
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

            await prisma.cvMinuteSection.create({
              data: {
                order: Number(s.order),
                name: s.name.trim(),
                content: jsonData.content,
                cvMinuteId: newCvMinute.id,
              },
            });
          }
        } else if (s.name === 'experiences') {
          // EXPERIENCES
          const openaiSectionResponse = await gpt3([
            {
              role: 'system',
              content: cvThequeCirterePrompts[item.index % 3][s.name].trim(),
            },
            {
              role: 'user',
              content: item.messageContent.trim(),
            },
          ]);

          if ('error' in openaiSectionResponse) {
            res.json({ openaiError: openaiSectionResponse.error });
            return;
          }

          for (const r of openaiSectionResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiSectionResponse.id,
                userId: item.user.id,
                request: 'cvthequeExperience',
                response: r.message.content ?? '',
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
              await prisma.cvMinuteSection.create({
                data: {
                  name: s.name.trim(),
                  title: item.title,
                  content: formatTextWithStrong(item.description),
                  date: item.date,
                  company: item.company,
                  order: i + 1,
                  cvMinuteId: newCvMinute.id,
                },
              });
            }
          }
        } else if (s.name === 'diplomes') {
          // DIPLOMES
          const openaiSectionResponse = await gpt3([
            {
              role: 'system',
              content: cvThequeCirterePrompts[item.index % 3][s.name].trim(),
            },
            {
              role: 'user',
              content: item.messageContent.trim(),
            },
          ]);

          if ('error' in openaiSectionResponse) {
            res.json({ openaiError: openaiSectionResponse.error });
            return;
          }

          for (const r of openaiSectionResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiSectionResponse.id,
                userId: item.user.id,
                request: 'cvthequeDiplomes',
                response: r.message.content ?? '',
                index: r.index,
              },
            });

            const jsonData: string[] = extractJson(r.message.content);

            if (!jsonData) {
              res.json({ parsingError: true });
              return;
            }

            await Promise.all(
              jsonData.map(async (item) => {
                await prisma.cvMinuteSection.create({
                  data: {
                    order: Number(s.order),
                    name: s.name.trim(),
                    content: item,
                    editable: true,
                    cvMinuteId: newCvMinute.id,
                  },
                });
              }),
            );
          }
        } else if (s.name === 'formation') {
          // FORMATION
          const openaiSectionResponse = await gpt3([
            {
              role: 'system',
              content: cvThequeCirterePrompts[item.index % 3][s.name].trim(),
            },
            {
              role: 'user',
              content: item.messageContent.trim(),
            },
          ]);

          if ('error' in openaiSectionResponse) {
            res.json({ openaiError: openaiSectionResponse.error });
            return;
          }

          for (const r of openaiSectionResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiSectionResponse.id,
                userId: item.user.id,
                request: 'cvthequeFormation',
                response: r.message.content ?? '',
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

            await prisma.cvMinuteSection.create({
              data: {
                order: Number(s.order),
                name: s.name.trim(),
                content: jsonData.content,
                editable: true,
                cvMinuteId: newCvMinute.id,
              },
            });
          }
        } else if (s.name === 'competence') {
          // COMPETENCE
          const openaiSectionResponse = await gpt3([
            {
              role: 'system',
              content: cvThequeCirterePrompts[item.index % 3][s.name].trim(),
            },
            {
              role: 'user',
              content: item.messageContent.trim(),
            },
          ]);

          if ('error' in openaiSectionResponse) {
            res.json({ openaiError: openaiSectionResponse.error });
            return;
          }

          for (const r of openaiSectionResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiSectionResponse.id,
                userId: item.user.id,
                request: 'cvthequeCompetence',
                response: r.message.content ?? '',
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

            await prisma.cvMinuteSection.create({
              data: {
                order: Number(s.order),
                name: s.name.trim(),
                content: jsonData.content,
                editable: true,
                cvMinuteId: newCvMinute.id,
              },
            });
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
        cvMinutes: {
          include: { cvMinuteSections: { orderBy: { order: 'desc' } } },
        },
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
