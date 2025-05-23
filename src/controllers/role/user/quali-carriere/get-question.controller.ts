import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { io, openai } from '@/socket';
import { CvMinuteSectionInterface } from '@/interfaces/role/user/cv-minute/cvMinuteSection.interface';
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
import { QualiCarriereQuestionInteface } from '@/interfaces/role/user/quali-carriere/qualiCarriereQuestionInterface';
import { CvMinuteInterface } from '@/interfaces/role/user/cv-minute/cvMinute.interface';

const prisma = new PrismaClient();

/*
  CVMINUTE
  CVMINUTESECTION
  SECTIONINFOS
*/

const getQualiCarriereQuestion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let qualiCarriereQuestion: QualiCarriereQuestionInteface | null = null;
    const { user } = res.locals;

    let cvMinute = await prisma.cvMinute.findFirst({
      where: { qualiCarriereRef: true, userId: user.id },
    });

    if (!cvMinute) {
      const cvMinutes = await prisma.cvMinute.findMany({
        where: { userId: user.id },
        include: { cvMinuteSections: true },
      });

      if (cvMinutes.length === 0) {
        res.json({ noCvMinute: true });
        return;
      }

      let bestCvMinute: CvMinuteInterface | null = null;
      let maxExperienceCount = 0;
      let bestCvMinuteSections: CvMinuteSectionInterface[] = [];

      for (const c of cvMinutes) {
        const experiences = c.cvMinuteSections.filter(
          (item) => item.name === 'experience',
        );

        if (experiences && experiences.length > maxExperienceCount) {
          maxExperienceCount = experiences.length;
          bestCvMinute = c;
          bestCvMinuteSections = c.cvMinuteSections;
        }
      }

      if (!bestCvMinute) {
        res.json({ noCvMinute: true });
        return;
      }

      // Création du nouveau cvMinute avec qualiCarriereRef
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

      const sectionInfosToCreate = bestCvMinuteSections?.map((info) => ({
        name: info.name,
        title: info.title,
        content: info.content,
        date: info.date,
        company: info.company,
        contrat: info.contrat,
        icon: info.icon,
        iconSize: info.iconSize,
        order: info.order ?? 1,
        cvMinuteId: bestCvMinute.id,
      }));

      if (sectionInfosToCreate) {
        await prisma.cvMinuteSection.createMany({ data: sectionInfosToCreate });
      }

      cvMinute = newCvMinute;
    }

    // Chargement final des données nécessaires
    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const getCvMinuteSection = (value: string) => {
      return cvMinuteSections.filter((s) => s.name === value);
    };

    const experiencesSection = getCvMinuteSection('experiences');

    if (!experiencesSection || experiencesSection.length === 0) {
      res.json({ noExperiences: true });
      return;
    }

    const sectionInfos = experiencesSection;

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResponses = await prisma.qualiCarriereResponse.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResumes = await prisma.qualiCarriereResume.findMany({
      where: { userId: user.id },
    });

    const totalQuestions = questionNumber(sectionInfos.length);

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
      const experiences = await prisma.cvMinuteSection.findMany({
        where: { id: { in: sectionInfos.map((s) => s.id) } },
        include: { qualiCarriereResumes: true, qualiCarriereCompetences: true },
      });

      if (qualiCarriereResumes.length === sectionInfos.length) {
        res.status(200).json({ nextStep: true, messages, experiences });
        return;
      } else {
        for (let i = 0; i < sectionInfos.length; i++) {
          const s = sectionInfos[i];
          const userExperience = `title : ${s.title}, date : ${s.date}, company : ${s.company}, contrat : ${s.contrat}, description : ${s.content}`;

          const restQuestions = questionNumberByIndex(i);
          const range = questionRangeByIndex(i);

          const prevQuestions = qualiCarriereQuestions
            .slice(range.start)
            .map(
              (q) =>
                `question : ${q.content}, réponse : ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
            )
            .join('\n');

          if (qualiCarriereResponses.length >= restQuestions) {
            const qualiCarriereResume =
              await prisma.qualiCarriereResume.findUnique({
                where: { cvMinuteSectionId: s.id },
              });

            if (!qualiCarriereResume) {
              const openaiResponse = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                  {
                    role: 'system',
                    content: qualiCarriereResumePrompt.trim(),
                  },
                  {
                    role: 'user',
                    content: `
                      Expérience : ${userExperience}\n
                      Entretien structuré : ${prevQuestions}
                    `.trim(),
                  },
                ],
              });

              if (openaiResponse.id) {
                for (const r of openaiResponse.choices) {
                  await prisma.openaiResponse.create({
                    data: {
                      responseId: openaiResponse.id,
                      userId: user.id,
                      request: 'quali-carriere-resume',
                      response:
                        r.message.content ?? 'quali-carriere-resume-response',
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
                      content: jsonData.resume.trim().toLocaleLowerCase(),
                      cvMinuteSectionId: s.id,
                    },
                  });

                  for (let i = 0; i < jsonData.competences.length; i++) {
                    const c = jsonData.competences[i];
                    await prisma.qualiCarriereCompetence.create({
                      data: {
                        userId: user.id,
                        content: c,
                        cvMinuteSectionId: s.id,
                      },
                    });
                  }
                }
              }
            }

            continue;
          }
        }

        res.status(200).json({ nextStep: true, messages, experiences });
        return;
      }
    } else {
      for (let i = 0; i < sectionInfos.length; i++) {
        const s = sectionInfos[i];
        const userExperience = `title : ${s.title}, date : ${s.date}, company : ${s.company}, contrat : ${s.contrat}, description : ${s.content}`;

        if (qualiCarriereQuestions.length > 0) {
          if (qualiCarriereResponses.length === 0) {
            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience: s,
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
                `question : ${q.content}, réponse : ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
            )
            .join('\n');

          if (
            qualiCarriereResponses.length <= restQuestions - 1 &&
            nextQuestion
          ) {
            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience: sectionInfos.find(
                (sInfo) => sInfo.id === nextQuestion.cvMinuteSectionId,
              ),
              question: nextQuestion,
              totalQuestions,
            });

            if (
              !afterNextQuestion &&
              qualiCarriereResponses.length < restQuestions - 1
            ) {
              const openaiResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: qualiCarriereNextQuestionPrompt.trim(),
                  },
                  {
                    role: 'user',
                    content: `Expérience :\n${userExperience}\nEntretien précédent :\n${prevQuestions}`,
                  },
                ],
              });

              if (openaiResponse.id) {
                for (const r of openaiResponse.choices) {
                  await prisma.openaiResponse.create({
                    data: {
                      responseId: openaiResponse.id,
                      userId: user.id,
                      request: 'quali-carriere-question',
                      response:
                        r.message.content ?? 'quali-carriere-question-response',
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
                        cvMinuteSectionId: s.id,
                      },
                    });

                    res.status(200).json({ nextQuestion: true });
                    return;
                  }
                }
              }
            }
          }
        } else {
          const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: qualiCarriereFirstQuestionPrompt.trim(),
              },
              {
                role: 'user',
                content: `Expérience : ${userExperience}`.trim(),
              },
            ],
          });

          if (openaiResponse.id) {
            for (const r of openaiResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiResponse.id,
                  userId: user.id,
                  request: 'quali-carriere-question',
                  response:
                    r.message.content ?? 'quali-carriere-question-response',
                  index: r.index,
                },
              });

              const jsonData: { questions: string } = extractJson(
                r.message.content,
              );

              if (!jsonData) {
                res.json({ parsingError: true });
                return;
              }

              for (let i = 0; i < jsonData.questions.length; i++) {
                const q = jsonData.questions[i];
                const newQualiCarriereQuestion =
                  await prisma.qualiCarriereQuestion.create({
                    data: {
                      content: q.trim().toLocaleLowerCase(),
                      order: qualiCarriereQuestions.length + i + 1,
                      userId: user.id,
                      cvMinuteSectionId: s.id,
                    },
                  });

                if (i === 0) {
                  qualiCarriereQuestion = newQualiCarriereQuestion;
                }
              }

              io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
                experience: s,
                question: qualiCarriereQuestion,
                totalQuestions,
              });

              res.status(200).json({ nextQuestion: true });
              return;
            }
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
