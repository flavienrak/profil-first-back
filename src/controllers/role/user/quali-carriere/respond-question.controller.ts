import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

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
import { qualiCarriereNextQuestionPrompt } from '@/utils/prompts/quali-carriere.prompt';

const prisma = new PrismaClient();

const respondQualiCarriereQuestion = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
    const { id } = req.params;
    const body: { cvMinuteSectionId: number; content?: string } = req.body;

    const cvMinute = await prisma.cvMinute.findFirst({
      where: { qualiCarriereRef: true, userId: user.id },
      include: { cvMinuteSections: true },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });
    const actualQuestion = qualiCarriereQuestions.find(
      (q) => q.id === Number(id),
    );
    if (!actualQuestion) {
      res.json({ qualiCarriereQuestionNotFound: true });
      return;
    }

    const qualiCarriereResponses = await prisma.qualiCarriereResponse.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResponse = qualiCarriereResponses.find(
      (r) => r.questionId === actualQuestion.id,
    );
    if (qualiCarriereResponse) {
      res.json({ alreadyResponded: true });
      return;
    }

    const cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.cvMinuteSectionId },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    if (body.content) {
      const qualiCarriereResponse = await prisma.qualiCarriereResponse.create({
        data: {
          questionId: actualQuestion.id,
          userId: user.id,
          content: body.content,
          cvMinuteSectionId: cvMinuteSection.id,
        },
      });
      qualiCarriereResponses.push(qualiCarriereResponse);
    } else if (req.file) {
      const extension = path.extname(req.file.originalname) || '.wav';
      const fileName = `audio-${user.id}-${Date.now()}${extension}`;
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(uploadsBase, `/files/user-${user.id}`);
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
        const qualiCarriereResponse = await prisma.qualiCarriereResponse.create(
          {
            data: {
              userId: user.id,
              questionId: actualQuestion.id,
              content: response.data.text,
              cvMinuteSectionId: cvMinuteSection.id,
            },
          },
        );
        qualiCarriereResponses.push(qualiCarriereResponse);
      }

      fs.unlinkSync(filePath);
    }

    const getCvMinuteSection = (value: string) => {
      return cvMinute.cvMinuteSections.filter((s) => s.name === value);
    };

    const experiences = getCvMinuteSection('experiences');

    if (!experiences || (experiences && experiences.length === 0)) {
      res.json({ noExperiences: true });
      return;
    }

    const nextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex((q) => q.id === actualQuestion.id) + 1
      ];

    const afterNextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex((q) => q.id === nextQuestion?.id) + 1
      ];

    const totalQuestions = questionNumber(experiences.length);

    if (qualiCarriereResponses.length === totalQuestions) {
      res.status(200).json({ nextStep: true });
      return;
    }

    for (let i = 0; i < experiences.length; i++) {
      const s = experiences[i];
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

      if (qualiCarriereResponses.length <= restQuestions - 1 && nextQuestion) {
        io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
          experience: experiences.find(
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
                content: `
                  Expérience : ${userExperience}\n 
                  Entretien : ${prevQuestions}
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

export { respondQualiCarriereQuestion };
