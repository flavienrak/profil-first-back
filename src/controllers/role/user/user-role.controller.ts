import express from 'express';

import { PrismaClient } from '@/prisma/client';

const prisma = new PrismaClient();

const acceptConditions = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { user } = res.locals;

    await prisma.user.update({
      where: { id: user.id },
      data: { acceptConditions: true },
    });

    res.status(200).json({ user: { acceptConditions: true } });
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

export { acceptConditions };
