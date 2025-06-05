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
import { CvMinuteInterface } from '@/interfaces/role/user/cv-minute/cvMinute.interface';
import { CompatibleUserInterface } from '@/interfaces/role/recruiter/cvtheque/compatibleUser.interface';
import { gpt3 } from '@/utils/openai';

const resendCvThequeCritere = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let updatedCvThequeCritere: CvThequeCritereInterface | null = null;
    const { id } = req.params;

    const cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvThequeViews: true,
        cvMinutes: {
          include: { cvMinuteSections: { orderBy: { order: 'desc' } } },
        },
      },
    });

    if (!cvThequeCritere) {
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

    const lines = [`intitulé : ${cvThequeCritere.position}`];

    if (cvThequeCritere.description) {
      lines.push(`description : ${cvThequeCritere.description}`);
    }

    if (
      cvThequeCritere.cvThequeCompetences &&
      cvThequeCritere.cvThequeCompetences.length > 0
    ) {
      const competences = cvThequeCritere.cvThequeCompetences
        .map((c) => c.content)
        .join('\n');
      lines.push(`compétences : ${competences}`);
    }

    if (cvThequeCritere.experience) {
      lines.push(`années d'expérience : ${cvThequeCritere.experience}`);
    }

    if (cvThequeCritere.diplome) {
      lines.push(`niveau de diplôme : ${cvThequeCritere.diplome}`);
    }

    if (cvThequeCritere.localisation) {
      lines.push(`localisation : ${cvThequeCritere.localisation}`);
    }

    if (cvThequeCritere.distance) {
      lines.push(`rayon : ${cvThequeCritere.distance}km`);
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
                    Contenus du CV :\n
                    Expériences : 
                    ${experiences
                      .map(
                        (item) =>
                          `postDate: ${item.date}, 
                           postCompany: ${item.company}, 
                           postTitle: ${item.title},
                           postDescription: ${item.content}, 
                           postSynthèse : ${qualiCarriereResumes.find((r) => r.cvMinuteSectionId === item.id)?.content}`,
                      )
                      .join('\n')}\n
                    Sections : ${allCvMinuteSections}\n
                    Offre ciblée : ${position}
                  `;
                } else {
                  messageContent = `
                    Contenus du CV :\n
                    Expériences : 
                    ${experiences
                      .map(
                        (item) =>
                          `postDate: ${item.date}, 
                           postCompany: ${item.company}, 
                           postTitle: ${item.title},
                           postContent: ${item.content}`,
                      )
                      .join('\n')}\n
                    Sections : ${allCvMinuteSections}\n
                    Offre ciblée : ${position}
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

    if (orderedUsers.length > 0) {
      for (
        let i = maxCvThequeUserResult * cvThequeCritere.evaluation;
        i < maxCvThequeUserResult * (cvThequeCritere.evaluation + 1);
        i++
      ) {
        const item = orderedUsers[i % orderedUsers.length];
        const loopIndex = Math.floor(i / orderedUsers.length);
        allUsers.push({ ...item, index: loopIndex });
      }
    }

    for (const item of allUsers) {
      const cvMinuteCount = await prisma.cvMinute.count({
        where: { cvThequeCritereId: cvThequeCritere.id },
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
      where: { id: cvThequeCritere.id },
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

export { resendCvThequeCritere };
