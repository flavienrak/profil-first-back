import express from 'express';

import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { io, openai } from '../../../../socket';
import { extractJson } from '../../../../utils/functions';

const prisma = new PrismaClient();

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

    const cvMinute = await prisma.cvMinute.findFirst({
      where: { userId: user.id, qualiCarriereRef: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const message = await prisma.qualiCarriereChat.create({
      data: {
        userId: user.id,
        role: 'user',
        content: body.message,
      },
    });

    io.to(`user-${user.id}`).emit('qualiCarriereMessage', message);

    const qualiCarriereResumes = await prisma.qualiCarriereResume.findMany({
      where: { userId: user.id },
    });

    const prevMessages = await prisma.qualiCarriereChat.findMany({
      where: { userId: user.id },
    });

    const resume = `
      Résumé: ${qualiCarriereResumes.map((r) => r.content).join('\n')}\n 
      Offre: ${cvMinute.position}\n
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
            Selon le résumé, l'offre et les discussions, répond au message de l'utilisateur.
            \n${resume}\n
            Règles à suivre:
            - Le retour doit contenir :
              { response:  }
            - Max 300 caractères.
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

    if (openaiResponse.id) {
      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            userId: user.id,
            request: 'quali-carriere-chat',
            response: r.message.content,
            index: r.index,
          },
        });

        const jsonData: { response: string } = extractJson(r.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        response = await prisma.qualiCarriereChat.create({
          data: {
            userId: user.id,
            role: 'system',
            content: jsonData.response,
          },
        });
      }
    }

    res.status(200).json({ response });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { sendQualiCarriereMessage };
