import express from 'express';

import { PrismaClient } from '@/prisma/client';

const prisma = new PrismaClient();

const checkCvCritereOwner = async (
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

  const cvThequeCritere = await prisma.cvThequeCritere.findUnique({
    where: { id: Number(id) },
  });

  if (!cvThequeCritere) {
    res.json({ cvCritereNotFound: true });
    return;
  } else if (cvThequeCritere.userId !== user.id) {
    res.json({ unAuthorized: true });
    return;
  }

  res.locals.cvThequeCritere = cvThequeCritere;
  next();
};

export { checkCvCritereOwner };
