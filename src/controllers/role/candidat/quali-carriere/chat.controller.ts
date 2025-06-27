import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { io } from '@/socket';
import { extractJson } from '@/utils/functions';
import { qualiCarriereChatResponsePrompt } from '@/utils/prompts/quali-carriere.prompt';
import { QualiCarriereChatInterface } from '@/interfaces/role/candidat/quali-carriere/qualiCarriereChatInterface';
import { gpt3 } from '@/utils/openai';
import { UserInterface } from '@/interfaces/user.interface';

const sendQualiCarriereMessage = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    let response: QualiCarriereChatInterface | null = null;
    const { user } = res.locals as { user: UserInterface };
    const body = req.body as { message: string };

    const cvMinute = await prisma.cvMinute.findFirst({
      where: { userId: user.id, qualiCarriereRef: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const qualiCarriereResumes = await prisma.qualiCarriereResume.findMany({
      where: { userId: user.id },
    });

    const prevMessages = await prisma.qualiCarriereChat.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 2,
    });

    const systemPrompt = qualiCarriereChatResponsePrompt.trim();
    const userPrompt = `
      Résumé du candidat :
      ${qualiCarriereResumes.map((r) => r.content).join('\n')}\n
      
      Récentes discussion :
      ${prevMessages.map((m, index) => `${index + 1}. ${m.role} : ${m.content}`).join('\n')}\n

      Dernier message :
      ${body.message}
    `.trim();

    const message = await prisma.qualiCarriereChat.create({
      data: {
        userId: user.id,
        role: 'user',
        content: body.message,
      },
    });

    io.to(`user-${user.id}`).emit('qualiCarriereMessage', message);

    const openaiResponse = await gpt3([
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ]);

    if ('error' in openaiResponse) {
      res.json({ openaiError: openaiResponse.error });
      return;
    }

    const responseChoice = openaiResponse.choices[0];

    if (responseChoice.message.content) {
      await prisma.openaiResponse.create({
        data: {
          responseId: openaiResponse.id,
          userId: user.id,
          request: 'qualiCarriereChat',
          response: responseChoice.message.content,
          index: responseChoice.index,
        },
      });

      const jsonData: { response: string } = extractJson(
        responseChoice.message.content,
      );

      if (!jsonData) {
        res.json({
          parsingError: true,
          message: responseChoice.message.content,
        });
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
