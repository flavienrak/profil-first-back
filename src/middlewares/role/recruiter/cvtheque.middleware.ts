import express from 'express';

import { PrismaClient } from '@prisma/client';

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

  const cvCritere = await prisma.cvCritere.findUnique({
    where: { id: Number(id) },
  });

  if (!cvCritere) {
    res.json({ cvCritereNotFound: true });
    return;
  } else if (cvCritere.userId !== user.id) {
    res.json({ unAuthorized: true });
    return;
  }

  res.locals.cvCritere = cvCritere;
  next();
};

export { checkCvCritereOwner };
