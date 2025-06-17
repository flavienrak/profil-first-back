import prisma from '@/lib/db';

import { Request, Response, NextFunction } from 'express';

const checkCvMinuteOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

const checkCvMinuteSection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { cvMinute } = res.locals;
  const { cvMinuteSectionId } = req.params;

  if (isNaN(Number(cvMinuteSectionId))) {
    res.json({ invalidCvMinuteSectionId: true });
    return;
  }

  const cvMinuteSection = await prisma.cvMinuteSection.findUnique({
    where: { id: Number(cvMinuteSectionId) },
  });

  if (!cvMinuteSection) {
    res.json({ cvMinuteSectionNotFound: true });
    return;
  } else if (cvMinuteSection.cvMinuteId !== cvMinute.id) {
    res.json({ unAuthorized: true });
    return;
  }

  res.locals.cvMinuteSection = cvMinuteSection;
  next();
};

export { checkCvMinuteOwner, checkCvMinuteSection };
