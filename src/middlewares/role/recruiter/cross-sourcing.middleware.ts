import express from 'express';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const checkCrossSourcingUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    res.json({ invalidId: true });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
  });

  if (!user) {
    res.json({ userNotFound: true });
    return;
  }

  res.locals.crossSourcingUser = user
  next();
};

export { checkCrossSourcingUser };
