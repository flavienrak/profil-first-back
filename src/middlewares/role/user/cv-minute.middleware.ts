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

const checkCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
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
