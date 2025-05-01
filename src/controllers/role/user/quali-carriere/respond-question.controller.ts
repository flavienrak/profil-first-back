import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { io, openai } from '../../../../socket';
import { SectionInterface } from '../../../../interfaces/role/cv-minute/section.interface';
import { CvMinuteSectionInterface } from '../../../../interfaces/role/cv-minute/cvMinuteSection.interface';
import {
  extractJson,
  questionNumber,
  questionNumberByIndex,
  questionRangeByIndex,
} from '../../../../utils/functions';

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
      const fileName = `audio-${res.locals.user.id}-${Date.now()}${extension}`;
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(
        uploadsBase,
        `/files/user-${res.locals.user.id}`,
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

    const { sectionInfos } = getCvMinuteSection('experiences');

    const totalQuestions = questionNumber(sectionInfos.length);

    const nextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex((q) => q.id === actualQuestion.id) + 1
      ];

    const afterNextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex((q) => q.id === nextQuestion?.id) + 1
      ];

    if (qualiCarriereResponses.length === totalQuestions) {
      res.status(200).json({ nextStep: true });
      return;
    }

    for (let i = 0; i < sectionInfos.length; i++) {
      const s = sectionInfos[i];
      const userExperience = `title: ${s.title}, date: ${s.date}, company: ${s.company}, contrat: ${s.contrat}, description: ${s.content}`;

      const restQuestions = questionNumberByIndex(i);
      const range = questionRangeByIndex(i);
      const prevQuestions = qualiCarriereQuestions
        .slice(range.start)
        .map(
          (q) =>
            `question: ${q.content}, réponse: ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
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
            model: 'gpt-4-turbo-preview',
            messages: [
              {
                role: 'system',
                content: `
                  Rôle : Tu es un expert RH/coach carrière avec une obsession pour la précision, l’impact et
                  le positionnement de haut niveau dans les CV.
                  Tu dois mener un échange conversationnel avec un candidat afin de qualifier en profondeur
                  une expérience professionnelle et produire la matière brute nécessaire à la rédaction de
                  bullet points puissants pour un CV.
                  Mantra
                  Ta mission principale est de faire parler au maximum le candidat en l’aidant à utiliser les bons
                  mots : ceux qui collent aux attentes du marché et donnent du poids à son parcours. Tu dois :
                  • Détecter les soft et hard skills cachés
                  • Extraire des termes techniques ou les vulgariser
                  • Récupérer des résultats chiffrés ou mesurables
                  • Identifier le niveau de responsabilité réel
                  • Traduire en langage “sexy” ce qui est souvent sous-estimé
                  Logique de l’entretien :
                  1. Contextualisation complète : Où, quand, pourquoi ? Quel enjeu business ? Quelle temporalité ?
                  2. Clarification des tâches : Qu’as-tu fait concrètement ? En autonomie ou pilotage ?
                  3. Précision des outils et méthodes : Avec quoi ? Comment ?
                  4. Interaction & posture : Avec qui ? Quel rôle dans l’équipe ? En transverse ? En frontal ?
                  5. Impacts & résultats : Qu’est-ce qui a changé ? Comment le mesurer ? Témoignage ou effet visible ?
                  6. Lexique CV : Recaler le vocabulaire utilisé vers celui du marché
                  Structure de chaque relance :
                  • Toujours rebondir sur les réponses précédentes (pas de questions en rafale)
                  • Si la réponse est vague : creuse avec “Peux-tu me donner un exemple ?” ou “Comment tu t’y es pris concrètement ?”
                  • Si la personne banalise : valorise, reformule, puis repose une version augmentée
                  • Si c’est trop long ou flou : reformule pour clarifier, puis valide avec “Tu veux dire que…”
                  Objectif final :
                  Réponses riches, concrètes, avec un wording orienté CV, pour rédiger des expériences qui
                  respirent la posture, l’expertise et la clarté de valeur.
                  Règles à suivre:
                  - Basé sur l'expérience de l'utilisateur et les entretiens précédents, poser la question suivante.
                  - Le retour doit contenir :
                    { question: }
                  - Max 110 caractères.
                  - Donne la réponse en json simple.
                `,
              },
              {
                role: 'user',
                content: `Expérience: ${userExperience}\n Entretien: ${prevQuestions}`,
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
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { respondQualiCarriereQuestion };
