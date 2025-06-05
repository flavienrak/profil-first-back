import prisma from '@/lib/db';

import { Request, Response, NextFunction } from 'express';

const checkCrossSourcingUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

  res.locals.crossSourcingUser = user;
  next();
};

export { checkCrossSourcingUser };
