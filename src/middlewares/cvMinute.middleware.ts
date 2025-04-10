import express from 'express';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const checkCvMinuteOwner = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const { id } = req.params;
  const { user } = res.locals;

  if (!id || isNaN(Number(id))) {
    res.json({ invalidId: true });
    return;
  }

  const cvMinute = await prisma.cvMinute.findUnique({
    where: { id: Number(id) },
  });

  if (!cvMinute) {
    res.json({ cvMinuteNotFound: true });
    return;
  } else if (cvMinute.userId !== user.id) {
    res.json({ unAuthorized: true });
    return;
  }

  res.locals.cvMinute = cvMinute;
  next();
};

export { checkCvMinuteOwner };
