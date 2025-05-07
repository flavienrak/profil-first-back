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

const prisma = new PrismaClient();

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

    const cvMinute = await prisma.cvMinute.findFirst({
      where: { qualiCarriereRef: true, userId: user.id },
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

    if (body.content) {
      const qualiCarriereResponse = await prisma.qualiCarriereResponse.create({
        data: {
          sectionInfoId: actualQuestion.sectionInfoId,
          questionId: actualQuestion.id,
          userId: user.id,
          content: body.content,
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
              sectionInfoId: actualQuestion.sectionInfoId,
              userId: user.id,
              questionId: actualQuestion.id,
              content: response.data.text,
            },
          },
        );
        qualiCarriereResponses.push(qualiCarriereResponse);
      }

      fs.unlinkSync(filePath);
    }

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: { sectionInfos: true },
    });

    const sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map(
            (section: CvMinuteSectionInterface) => section.sectionId,
          ),
        },
      },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find(
        (s) => s.name.toLowerCase() === value.toLowerCase(),
      );
      return cvMinuteSections.find((s) => s.sectionId === section?.id);
    };

    const experiences = getCvMinuteSection('experiences');
    const sectionInfos = experiences?.sectionInfos;

    if (!sectionInfos || (sectionInfos && sectionInfos.length === 0)) {
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

    const totalQuestions = questionNumber(sectionInfos.length);

    if (qualiCarriereResponses.length === totalQuestions) {
      res.status(200).json({ nextStep: true });
      return;
    }

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

      if (qualiCarriereResponses.length <= restQuestions - 1 && nextQuestion) {
        io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
          experience: sectionInfos.find(
            (sInfo) => sInfo.id === nextQuestion.sectionInfoId,
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
                content: `
                  Tu es un expert RH / coach carrière, spécialiste de la formulation d’expériences percutantes pour le CV.

                  Objectif :
                  Mener un échange conversationnel avec un candidat pour qualifier une expérience pro et récolter les bons mots pour rédiger des bullet points à fort impact.

                  Ton rôle :
                  - Faire parler le candidat au maximum, avec un vocabulaire orienté marché.
                  - Extraire :
                    • Soft & hard skills dissimulés
                    • Résultats chiffrés / mesurables
                    • Outils, méthodes, techniques
                    • Niveaux de responsabilité
                    • Formulations puissantes adaptées aux recruteurs

                  Logique d’entretien (à suivre en boucle) :
                  1. Contexte : Où ? Quand ? Pourquoi ? Enjeux ?
                  2. Tâches : Qu’as-tu fait concrètement ? Seul ou en équipe ?
                  3. Outils & méthodes : Comment ? Avec quoi ?
                  4. Interactions : Avec qui ? Quel rôle ? (hiérarchie, transversalité…)
                  5. Impacts : Résultats visibles ? KPIs ? Chiffres ? Progrès ?
                  6. Reformulation CV : Transformer ce qui est banal ou flou en langage CV clair et vendeur

                  Règles d’interaction :
                  - Toujours rebondir sur la réponse précédente (pas de rafale de questions).
                  - Si flou : "Peux-tu donner un exemple ?" / "Comment t’y es-tu pris ?"
                  - Si banal : Reformule pour valoriser, puis pose une version améliorée.
                  - Si long ou confus : Clarifie et valide ("Tu veux dire que… ?")

                  Contraintes :
                  - Max 110 caractères.
                  - Respecter les sauts à la ligne demandé.
                  - Ne jamais sortir du format demandé.

                  Format attendu :
                  { question: "..." }
                `.trim(),
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
                    sectionInfoId: s.id,
                    content: jsonData.question.trim().toLocaleLowerCase(),
                    order: qualiCarriereQuestions.length + 1,
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
