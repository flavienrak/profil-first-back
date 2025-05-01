import express from 'express';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const acceptConditions = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: res.locals.user.id },
      data: { acceptConditions: true },
    });

    res.status(200).json({ user: { acceptConditions: true } });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { acceptConditions };
