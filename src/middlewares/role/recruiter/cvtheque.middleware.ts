import prisma from '@/lib/db';

import { Request, Response, NextFunction } from 'express';
import { UserInterface } from '@/interfaces/user.interface';

const checkCvCritereOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { user } = res.locals as { user: UserInterface };

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
