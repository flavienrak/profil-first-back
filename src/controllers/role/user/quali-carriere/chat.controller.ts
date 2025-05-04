import express from 'express';
import OpenAI from 'openai';

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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `
          Tu es un expert en rédaction et optimisation de CV. 
          Tu aides l'utilisateur à valoriser ses expériences professionnelles. 
          Réponds toujours sous forme de JSON : { "response": "..." } avec un maximum de 300 caractères.
        `.trim(),
      },
      {
        role: 'user',
        content: `
          Résumé du candidat :
          ${qualiCarriereResumes.map((r) => r.content).join('\n')}

          Offre ciblée :
          ${cvMinute.position}

          Historique de la discussion :
          ${prevMessages.map((m, index) => `${index + 1}. ${m.role} : ${m.content}`).join('\n')}

          Dernier message :
          ${message.content}
        `.trim(),
      },
    ];

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
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
