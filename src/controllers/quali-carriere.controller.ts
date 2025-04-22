import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { openai } from '../socket';
import { questionNumber } from '../utils/constants';

const prisma = new PrismaClient();

const getQualiCarriereQuestion = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let question = null;
    let qualiCarriereQuestion = null;
    let qualiCarriereResume = null;
    const { user } = res.locals;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });

    if (qualiCarriereQuestions.length > 0) {
      const lastQuestionRes = await prisma.qualiCarriereResponse.findFirst({
        where: { userId: user.id },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (lastQuestionRes) {
        const questionIndex = qualiCarriereQuestions.findIndex(
          (q) => q.questionId === lastQuestionRes.id,
        );
        if (questionIndex === qualiCarriereQuestions.length - 1) {
          qualiCarriereResume = await prisma.qualiCarriereResume.findUnique({
            where: { userId: user.id },
          });

          if (!qualiCarriereResume) {
            const qualiCarriereQuestions =
              await prisma.qualiCarriereQuestion.findMany({
                where: { userId: user.id },
                include: { qualiCarriereResponse: true },
              });

            const questions = await prisma.question.findMany({
              where: {
                id: { in: qualiCarriereQuestions.map((q) => q.questionId) },
              },
            });

            const userMessage = questions
              .map(
                (q, index: number) =>
                  `${index + 1}: ${q.content}: ${qualiCarriereQuestions[index].qualiCarriereResponse.content}`,
              )
              .join('\n');

            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'system',
                  content: `
                    Vous êtes un expert en redaction et optimisation de CV. 
                    Selon les questions posées à l'utilisateur et les réponses, génère le résumé détaillé.
                    Règles à suivre:
                    - Le retour doit contenir :
                      { resume:  }
                    - Aérer le contenu en mettant à la ligne les phrases quand c'est nécessaire.
                    - Donne la réponse en json simple.
                  `,
                },
                {
                  role: 'user',
                  content: userMessage,
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
                    response: r.message.content,
                    index: r.index,
                  },
                });

                const match = r.message.content.match(
                  /```json\s*([\s\S]*?)\s*```/,
                );
                if (match) {
                  const jsonString = match[1];
                  const jsonData: { resume: string } = JSON.parse(jsonString);

                  qualiCarriereResume = await prisma.qualiCarriereResume.create(
                    { data: { userId: user.id, content: jsonData.resume } },
                  );
                }
              }
            }
          }

          const messages = await prisma.qualiCarriereChat.findMany({
            where: { userId: user.id },
            orderBy: {
              createdAt: 'asc',
            },
          });

          res
            .status(200)
            .json({ nextStep: true, qualiCarriereResume, messages });
          return;
        } else {
          qualiCarriereQuestion = qualiCarriereQuestions[questionIndex + 1];
        }
      } else {
        qualiCarriereQuestion = qualiCarriereQuestions[0];
      }

      if (!qualiCarriereQuestion) {
        res.json({ nextStep: true });
        return;
      }

      question = await prisma.question.findUnique({
        where: { id: qualiCarriereQuestion.questionId },
      });
    } else {
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `
              Vous êtes un expert en redaction et optimisation de CV. 
              Donne ${questionNumber} questions sur lesquelles on peut tirer le maximum d'informations sur une personne.
              Règles à suivre:
              - Le retour doit contenir :
                { questions: [] }
              - Pas de questions personnelles.
              - Plus de 15 questions sur les 5 dernieres expériences.
              - Plus 5 questions sur les autres expériences.
              - Donne la réponse en json simple.
            `,
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
              response: r.message.content,
              index: r.index,
            },
          });

          const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
          if (match) {
            const jsonString = match[1];
            const jsonData: { questions: string[] } = JSON.parse(jsonString);

            for (let i = 0; i < jsonData.questions.length; i++) {
              const q = jsonData.questions[i];
              if (i === 0) {
                question = jsonData.questions[0];
              }

              const existQuestion = await prisma.question.findFirst({
                where: { content: q.trim().toLocaleLowerCase() },
              });

              if (existQuestion) {
                qualiCarriereQuestion =
                  await prisma.qualiCarriereQuestion.create({
                    data: {
                      userId: user.id,
                      questionId: existQuestion.id,
                      order: i + 1,
                    },
                  });
              } else {
                const newQuestion = await prisma.question.create({
                  data: { content: q.trim().toLocaleLowerCase() },
                });
                qualiCarriereQuestion =
                  await prisma.qualiCarriereQuestion.create({
                    data: {
                      userId: user.id,
                      questionId: newQuestion.id,
                      order: i + 1,
                    },
                  });
              }
            }
          }
        }
      }
    }

    res.status(200).json({ question, qualiCarriereQuestion });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const respondQualiCarriereQuestion = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { user } = res.locals;
    const { id } = req.params;
    const body: { content?: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });

    const qualiCarriereQuestion = qualiCarriereQuestions.find(
      (q) => q.id === Number(id),
    );

    if (!qualiCarriereQuestion) {
      res.json({ qualiCarriereQuestionNotFound: true });
      return;
    }

    const qualiCarriereResponse = await prisma.qualiCarriereResponse.findUnique(
      { where: { questionId: Number(id) } },
    );

    if (qualiCarriereResponse) {
      res.json({ alreadyResponded: true });
      return;
    }

    if (body.content) {
      await prisma.qualiCarriereResponse.create({
        data: {
          questionId: qualiCarriereQuestion.id,
          userId: user.id,
          content: body.content,
        },
      });
    } else if (req.file) {
      const extension = path.extname(req.file.originalname) || '.wav';
      const fileName = `audio-${res.locals.user.id}-${Date.now()}${extension}`;
      const directoryPath = path.join(
        __dirname,
        `../uploads/files/user-${res.locals.user.id}`,
      );
      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('model', 'whisper-1');
      formData.append('language', 'fr');

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
        },
      );

      if (response.data) {
        await prisma.qualiCarriereResponse.create({
          data: {
            questionId: qualiCarriereQuestion.id,
            userId: user.id,
            content: response.data.text,
          },
        });
      }

      fs.unlinkSync(filePath);
    }

    const nextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex(
          (q) => q.questionId === qualiCarriereQuestion.id,
        ) + 1
      ];

    if (!nextQuestion) {
      res.json({ nextStep: true });
      return;
    }

    const question = await prisma.question.findUnique({
      where: { id: nextQuestion.questionId },
    });

    res.status(200).json({ question, qualiCarriereQuestion: nextQuestion });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const sendQualiCarriereMessage = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let response = null;
    const { user } = res.locals;
    const body: { message: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const message = await prisma.qualiCarriereChat.create({
      data: {
        userId: user.id,
        role: 'user',
        content: body.message,
      },
    });

    const qualiCarriereResume = await prisma.qualiCarriereResume.findUnique({
      where: { userId: user.id },
    });

    const prevMessages = await prisma.qualiCarriereChat.findMany({
      where: { userId: user.id },
    });

    const resume = `
      Résumé: ${qualiCarriereResume.content}\n 
      Messages:\n 
        1. system: ${'Bonjour ! Je suis là pour vous aider à valoriser vos expériences professionnelles.'}\n
        ${prevMessages.map((m, index: number) => `${index + 2} ${m.role}: ${m.content} \n`).join('\n')}
    `;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `
            Vous êtes un expert en redaction et optimisation de CV. 
            Selon le résumé et les discussions, répond au message de l'utilisateur.
            \n${resume}\n
            Règles à suivre:
            - Le retour doit contenir :
              { response:  }
            - Aérer la réponse en mettant à la ligne les phrases quand c'est nécessaire.
            - Donne la réponse en json simple.
          `,
        },
        {
          role: 'user',
          content: message.content,
        },
      ],
    });

    console.log(openaiResponse);

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            userId: user.id,
            request: 'quali-carriere-resume',
            response: r.message.content,
            index: r.index,
          },
        });

        const match = r.message.content.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const jsonString = match[1];
          const jsonData: { response: string } = JSON.parse(jsonString);

          response = await prisma.qualiCarriereChat.create({
            data: {
              userId: user.id,
              role: 'system',
              content: jsonData.response,
            },
          });
        }
      }
    }

    res.status(200).json({ message, response });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export {
  getQualiCarriereQuestion,
  respondQualiCarriereQuestion,
  sendQualiCarriereMessage,
};
