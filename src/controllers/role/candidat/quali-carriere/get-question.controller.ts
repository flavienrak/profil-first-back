import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { io } from '@/socket';
import {
  extractJson,
  questionNumber,
  questionNumberByIndex,
  questionRangeByIndex,
} from '@/utils/functions';
import {
  qualiCarriereFirstQuestionPrompt,
  qualiCarriereNextQuestionPrompt,
  qualiCarriereResumePrompt,
} from '@/utils/prompts/quali-carriere.prompt';
import { QualiCarriereQuestionInteface } from '@/interfaces/role/candidat/quali-carriere/qualiCarriereQuestionInterface';
import { CvMinuteInterface } from '@/interfaces/role/candidat/cv-minute/cvMinute.interface';
import { gpt3, gpt4 } from '@/utils/openai';
import { UserInterface } from '@/interfaces/user.interface';

const getQualiCarriereQuestion = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let qualiCarriereQuestion: QualiCarriereQuestionInteface | null = null;
    const { user } = res.locals as { user: UserInterface };

    let cvMinute = await prisma.cvMinute.findFirst({
      where: { qualiCarriereRef: true, userId: user.id },
      include: {
        cvMinuteSections: {
          include: {
            qualiCarriereResumes: true,
            qualiCarriereCompetences: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!cvMinute) {
      const cvMinutes = await prisma.cvMinute.findMany({
        where: { userId: user.id },
        include: { cvMinuteSections: { orderBy: { order: 'asc' } } },
      });

      if (cvMinutes.length === 0) {
        res.json({ noCvMinute: true });
        return;
      }

      let bestCvMinute: CvMinuteInterface | null = null;
      let maxExperienceCount = 0;

      for (const c of cvMinutes) {
        const experiences = c.cvMinuteSections.filter(
          (item) => item.name === 'experiences',
        );

        if (experiences && experiences.length > maxExperienceCount) {
          maxExperienceCount = experiences.length;
          bestCvMinute = c;
        }
      }

      if (!bestCvMinute) {
        res.json({ noCvMinute: true });
        return;
      }

      // COPY CVMINUTE
      const newCvMinute = await prisma.cvMinute.create({
        data: {
          position: bestCvMinute.position,
          name: bestCvMinute.name,
          primaryBg: bestCvMinute.primaryBg,
          secondaryBg: bestCvMinute.secondaryBg,
          tertiaryBg: bestCvMinute.tertiaryBg,
          userId: bestCvMinute.userId,
          visible: bestCvMinute.visible,
          qualiCarriereRef: true,
        },
      });

      const cvMinuteSectionsToCreate = bestCvMinute.cvMinuteSections?.map(
        (info) => ({
          name: info.name,
          title: info.title,
          content: info.content,
          date: info.date,
          company: info.company,
          contrat: info.contrat,
          icon: info.icon,
          iconSize: info.iconSize,
          order: info.order ?? undefined,
          cvMinuteId: newCvMinute.id,
        }),
      );

      if (cvMinuteSectionsToCreate) {
        await prisma.cvMinuteSection.createMany({
          data: cvMinuteSectionsToCreate,
        });
      }

      cvMinute = await prisma.cvMinute.findUnique({
        where: { id: newCvMinute.id },
        include: {
          cvMinuteSections: {
            include: {
              qualiCarriereResumes: true,
              qualiCarriereCompetences: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      });
    }

    // Chargement final des données nécessaires
    const cvMinuteExperiences = cvMinute?.cvMinuteSections.filter(
      (item) => item.name === 'experiences',
    );

    if (!cvMinuteExperiences || cvMinuteExperiences.length === 0) {
      res.json({ noExperiences: true });
      return;
    }

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResponses = await prisma.qualiCarriereResponse.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResumes = await prisma.qualiCarriereResume.findMany({
      where: { userId: user.id },
    });

    const totalQuestions = questionNumber(cvMinuteExperiences.length);

    const lastResponse =
      qualiCarriereResponses[qualiCarriereResponses.length - 1];

    const nextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex(
          (q) => q.id === lastResponse?.questionId,
        ) + 1
      ];

    const afterNextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex((q) => q.id === nextQuestion?.id) + 1
      ];

    if (qualiCarriereResponses.length === totalQuestions) {
      const messages = await prisma.qualiCarriereChat.findMany({
        where: { userId: user.id },
      });

      if (qualiCarriereResumes.length === cvMinuteExperiences.length) {
        res.status(200).json({ nextStep: true, messages, cvMinute });
        return;
      } else {
        for (let i = 0; i < cvMinuteExperiences.length; i++) {
          const experience = cvMinuteExperiences[i];

          const existResume = await prisma.qualiCarriereResume.findUnique({
            where: { cvMinuteSectionId: experience.id },
          });

          if (!existResume) {
            const userExperience = `
              title: ${experience.title}, 
              date: ${experience.date}, 
              company: ${experience.company}, 
              contrat: ${experience.contrat}, 
              description: ${experience.content}
            `;

            const restQuestions = questionNumberByIndex(i);
            const range = questionRangeByIndex(i);

            const prevQuestions = qualiCarriereQuestions
              .slice(range.start)
              .map(
                (q) =>
                  `question: ${q.content}, réponse: ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
              )
              .join('\n');

            if (qualiCarriereResponses.length >= restQuestions) {
              const qualiCarriereResume =
                await prisma.qualiCarriereResume.findUnique({
                  where: { cvMinuteSectionId: experience.id },
                });

              if (!qualiCarriereResume) {
                const openaiResponse = await gpt4([
                  {
                    role: 'system',
                    content: qualiCarriereResumePrompt.trim(),
                  },
                  {
                    role: 'user',
                    content: `
                      Expérience: ${userExperience}\n
                      Entretien structuré: ${prevQuestions}
                    `.trim(),
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
                      userId: user.id,
                      request: 'qualiCarriereResume',
                      response: r.message.content ?? '',
                      index: r.index,
                    },
                  });
                  const jsonData: { resume: string; competences: string[] } =
                    extractJson(r.message.content);

                  if (!jsonData) {
                    res.json({ parsingError: true });
                    return;
                  }

                  await prisma.qualiCarriereResume.create({
                    data: {
                      userId: user.id,
                      content: jsonData.resume,
                      cvMinuteSectionId: experience.id,
                    },
                  });

                  for (const c of jsonData.competences) {
                    await prisma.qualiCarriereCompetence.create({
                      data: {
                        content: c,
                        userId: user.id,
                        cvMinuteSectionId: experience.id,
                      },
                    });
                  }
                }
              }

              continue;
            }
          }
        }

        res.status(200).json({ nextStep: true, messages, cvMinute });
        return;
      }
    } else {
      for (let i = 0; i < cvMinuteExperiences.length; i++) {
        const experience = cvMinuteExperiences[i];
        const userExperience = `
          title: ${experience.title}, 
          date: ${experience.date}, 
          company: ${experience.company}, 
          contrat: ${experience.contrat}, 
          description: ${experience.content}
        `;

        if (qualiCarriereQuestions.length > 0) {
          if (qualiCarriereResponses.length === 0) {
            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience,
              question: qualiCarriereQuestions[0],
              totalQuestions,
            });

            res.status(200).json({ nextQuestion: true });
            return;
          }

          const restQuestions = questionNumberByIndex(i);
          const range = questionRangeByIndex(i);

          const prevQuestions = qualiCarriereQuestions
            .slice(range.start)
            .map(
              (q) =>
                `question: ${q.content}, réponse: ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
            )
            .join('\n');

          if (
            qualiCarriereResponses.length <= restQuestions - 1 &&
            nextQuestion
          ) {
            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience: cvMinuteExperiences.find(
                (exp) => exp.id === nextQuestion.cvMinuteSectionId,
              ),
              question: nextQuestion,
              totalQuestions,
            });

            if (
              !afterNextQuestion &&
              qualiCarriereResponses.length < restQuestions - 1
            ) {
              const openaiResponse = await gpt3([
                {
                  role: 'system',
                  content: qualiCarriereNextQuestionPrompt.trim(),
                },
                {
                  role: 'user',
                  content: `
                    Expérience: ${userExperience}\n 
                    Entretien précédent: ${prevQuestions}
                  `,
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
                    userId: user.id,
                    request: 'qualiCarriereQuestion',
                    response: r.message.content ?? '',
                    index: r.index,
                  },
                });

                const jsonData: { question: string } = extractJson(
                  r.message.content,
                );

                if (!jsonData) {
                  res.json({ parsingError: true });
                  return;
                }

                if (jsonData) {
                  await prisma.qualiCarriereQuestion.create({
                    data: {
                      userId: user.id,
                      content: jsonData.question.trim().toLocaleLowerCase(),
                      order: qualiCarriereQuestions.length + 1,
                      cvMinuteSectionId: experience.id,
                    },
                  });

                  res.status(200).json({ nextQuestion: true });
                  return;
                }
              }
            }
          }
        } else {
          const openaiResponse = await gpt3([
            {
              role: 'system',
              content: qualiCarriereFirstQuestionPrompt.trim(),
            },
            {
              role: 'user',
              content: `Expérience: ${userExperience}`.trim(),
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
                userId: user.id,
                request: 'qualiCarriereQuestion',
                response: r.message.content ?? '',
                index: r.index,
              },
            });

            const jsonData: { questions: string[] } = extractJson(
              r.message.content,
            );

            if (!jsonData) {
              res.json({ parsingError: true });
              return;
            }

            for (let i = 0; i < jsonData.questions.length; i++) {
              const question = jsonData.questions[i];
              const newQualiCarriereQuestion =
                await prisma.qualiCarriereQuestion.create({
                  data: {
                    content: question,
                    order: qualiCarriereQuestions.length + i + 1,
                    userId: user.id,
                    cvMinuteSectionId: experience.id,
                  },
                });

              if (i === 0) {
                qualiCarriereQuestion = newQualiCarriereQuestion;
              }
            }

            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience,
              question: qualiCarriereQuestion,
              totalQuestions,
            });

            res.status(200).json({ nextQuestion: true });
            return;
          }
        }
      }
    }

    res.status(200).json({ nextQuestion: true });
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

export { getQualiCarriereQuestion };
