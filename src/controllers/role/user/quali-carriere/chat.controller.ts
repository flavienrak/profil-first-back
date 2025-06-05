import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { io } from '@/socket';
import { extractJson } from '@/utils/functions';
import { qualiCarriereChatResponsePrompt } from '@/utils/prompts/quali-carriere.prompt';
import { QualiCarriereChatInterface } from '@/interfaces/role/user/quali-carriere/qualiCarriereChatInterface';
import { gpt3 } from '@/utils/openai';

const sendQualiCarriereMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let response: QualiCarriereChatInterface | null = null;
    const { user } = res.locals;
    const body: { message: string } = req.body;

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

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: qualiCarriereChatResponsePrompt.trim(),
      },
      {
        role: 'user',
        content: `
          Résumé du candidat :
          ${qualiCarriereResumes.map((r) => r.content).join('\n')}\n
          
          Historique de la discussion :
          ${prevMessages.map((m, index) => `${index + 1}. ${m.role} : ${m.content}`).join('\n')}\n

          Dernier message :
          ${message.content}
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
          request: 'qualiCarriereChat',
          response: r.message.content ?? '',
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
          role: 'system',
          content: jsonData.response,
          userId: user.id,
        },
      });
    }

    res.status(200).json({ response });
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

export { sendQualiCarriereMessage };
