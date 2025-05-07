import { Request, Response } from 'express';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { openai } from '@/socket';
import { extractJson } from '@/utils/functions';
import { cvThequesections, maxCvThequeUserResult } from '@/utils/constants';
import { cvThequePrompts } from '@/utils/prompts';
import { CvThequeCritereInterface } from '@/interfaces/role/recruiter/cvtheque/cvtheque-critere.interface';
import { CvMinuteInterface } from '@/interfaces/role/user/cv-minute/cvMinute.interface';
import { UserInterface } from '@/interfaces/user.interface';

const prisma = new PrismaClient();

const resendCvThequeCritere = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    let compatibleUsers: {
      score: number;
      user: UserInterface;
      messageContent: string;
    }[] = [];
    let updatedCvThequeCritere: CvThequeCritereInterface | null = null;
    const { id } = req.params;

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
          include: {
            cvMinuteSections: { include: { sectionInfos: true } },
          },
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
          include: { cvMinuteSections: { include: { sectionInfos: true } } },
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

    for (const u of users) {
      const userDomains = u.cvMinuteDomains.map((item) => item.content);

      if (
        u.cvMinutes.length > 0 &&
        userDomains.includes(cvThequeCritere.domain)
      ) {
        const cvMinuteIds = u.cvMinuteDomains.map((item) => item.cvMinuteId);
        const cvMinutes = u.cvMinutes.filter((item) =>
          cvMinuteIds.includes(item.id),
        );

        if (cvMinutes.length > 0) {
          let cvMinute: CvMinuteInterface | null = null;
          let maxExperienceCount = 0;

          for (const c of cvMinutes) {
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
              return c.cvMinuteSections.find(
                (s) => s.sectionId === section?.id,
              );
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
                  in: cvMinute.cvMinuteSections?.map(
                    (section) => section.sectionId,
                  ),
                },
              },
            });

            const getCvMinuteSection = (value: string) => {
              const section = sections.find(
                (s) => s.name.toLowerCase() === value.toLowerCase(),
              );
              return cvMinute.cvMinuteSections?.find(
                (s) => s.sectionId === section?.id,
              );
            };

            const experiences = getCvMinuteSection('experiences');

            if (
              experiences &&
              experiences.sectionInfos &&
              experiences.sectionInfos.length > 0
            ) {
              let messageContent = '';
              const editableSections = sections.filter((s) => s.editable);
              const allCvMinuteSections = editableSections
                .map((s) => {
                  const cvMinuteSection = getCvMinuteSection(s.name);
                  if (cvMinuteSection && cvMinuteSection.sectionInfos) {
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
                      À partir du contenu du CV et de l’offre ciblée, évaluer la compatibilité entre le contenu d'un CV et une offre ciblée, en attribuant un score de 0 à 100.

                      Règles de compatibilité :
                      - Si le score est strictement supérieur à 50, considérer le CV comme compatible.
                      - Sinon, considérer comme non compatible.

                      Contraintes :
                      - Ne jamais sortir du format demandé

                      Format attendu :
                      {
                        compatible: "true" ou "false",
                        score: "valeur entre 0 et 100"
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

                  const jsonData: {
                    compatible: boolean;
                    score: number;
                  } = extractJson(r.message.content);

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
                            cvThequeCritereId: cvThequeCritere.id,
                          },
                        },
                      });

                    if (!existCvThequeUser) {
                      await prisma.cvThequeUser.create({
                        data: {
                          score: jsonData.score,
                          userId: u.id,
                          cvThequeCritereId: cvThequeCritere.id,
                        },
                      });
                    }

                    compatibleUsers.push({
                      score: jsonData.score,
                      user: u,
                      messageContent,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    const orderedUsers = compatibleUsers.sort((a, b) => b.score - a.score);
    const allUsers: {
      index: number;
      score: number;
      user: UserInterface;
      messageContent: string;
    }[] = [];

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
        let section = await prisma.section.findUnique({
          where: {
            name: s.name.trim().toLowerCase(),
          },
        });

        if (!section) {
          section = await prisma.section.create({
            data: {
              name: s.name.trim().toLowerCase(),
              editable: true,
            },
          });
        }

        const cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: newCvMinute.id,
            sectionId: section.id,
            sectionOrder: s.order,
            sectionTitle: s.name.trim(),
          },
        });

        if (s.name === 'title') {
          // TITLE
          const openaiSectionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: cvThequePrompts[item.index % 3][s.name].trim(),
              },
              {
                role: 'user',
                content: item.messageContent.trim(),
              },
            ],
          });

          if (openaiSectionResponse.id) {
            for (const r of openaiSectionResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiSectionResponse.id,
                  userId: item.user.id,
                  request: 'cvtheque-title',
                  response: r.message.content ?? 'cvtheque-title-response',
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
          const openaiSectionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: cvThequePrompts[item.index % 3][s.name].trim(),
              },
              {
                role: 'user',
                content: item.messageContent.trim(),
              },
            ],
          });

          if (openaiSectionResponse.id) {
            for (const r of openaiSectionResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiSectionResponse.id,
                  userId: item.user.id,
                  request: 'cvtheque-presentation',
                  response:
                    r.message.content ?? 'cvtheque-presentation-response',
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
          const openaiSectionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: cvThequePrompts[item.index % 3][s.name].trim(),
              },
              {
                role: 'user',
                content: item.messageContent.trim(),
              },
            ],
          });

          if (openaiSectionResponse.id) {
            for (const r of openaiSectionResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiSectionResponse.id,
                  userId: item.user.id,
                  request: 'cvtheque-experience',
                  response: r.message.content ?? 'cvtheque-experience-response',
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
          const openaiSectionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: cvThequePrompts[item.index % 3][s.name].trim(),
              },
              {
                role: 'user',
                content: item.messageContent.trim(),
              },
            ],
          });

          if (openaiSectionResponse.id) {
            for (const r of openaiSectionResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiSectionResponse.id,
                  userId: item.user.id,
                  request: 'cvtheque-diplomes',
                  response: r.message.content ?? 'cvtheque-diplomes-response',
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
          const openaiSectionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: cvThequePrompts[item.index % 3][s.name].trim(),
              },
              {
                role: 'user',
                content: item.messageContent.trim(),
              },
            ],
          });

          if (openaiSectionResponse.id) {
            for (const r of openaiSectionResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiSectionResponse.id,
                  userId: item.user.id,
                  request: 'cvtheque-formation',
                  response: r.message.content ?? 'cvtheque-formation-response',
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
          const openaiSectionResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: cvThequePrompts[item.index % 3][s.name].trim(),
              },
              {
                role: 'user',
                content: item.messageContent.trim(),
              },
            ],
          });

          if (openaiSectionResponse.id) {
            for (const r of openaiSectionResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiSectionResponse.id,
                  userId: item.user.id,
                  request: 'cvtheque-competence',
                  response: r.message.content ?? 'cvtheque-competence-response',
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

export { resendCvThequeCritere };
