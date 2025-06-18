import prisma from '@/lib/db';

import { Request, Response, NextFunction } from 'express';
import { UserInterface } from '@/interfaces/user.interface';

const now = new Date();

const checkUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = res.locals as { user: UserInterface };

  if (user.role !== 'candidat') {
    res.json({ notPermitted: true });
    return;
  }

  const cvMinuteCount = await prisma.cvMinute.count({
    where: { userId: user.id, qualiCarriereRef: false, generated: null },
  });

  res.locals.cvMinuteCount = cvMinuteCount;

  next();
};

const getCvMinuteCards = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = res.locals as { user: UserInterface };

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    include: { credit: true },
  });

  const freeCard = payments.find((item) => item.type === 'free');
  const premiumCards = payments.filter((item) => item.type === 'premium');
  const boosterCards = payments.filter((item) => item.type === 'booster');

  const freeCredits = freeCard?.credit?.value ?? 0;
  const boosterCredits = boosterCards.reduce((sum, item) => {
    if (item.credit) {
      return sum + item.credit.value;
    }
    return sum;
  }, 0);
  const premiumCredits = premiumCards.reduce((sum, item) => {
    if (item.credit && item.expiredAt && new Date(item.expiredAt) > now) {
      return sum + item.credit.value;
    }
    return sum;
  }, 0);
  const totalCredits = freeCredits + boosterCredits + premiumCredits;

  res.locals.freeCard = freeCard;
  res.locals.premiumCards = premiumCards;
  res.locals.boosterCards = boosterCards;

  res.locals.totalCredits = totalCredits;

  next();
};

const checkQualiCarriere = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = res.locals as { user: UserInterface };

  const payments = await prisma.payment.findMany({
    where: { userId: user.id, type: 'quali-carriere' },
    include: { credit: true },
  });

  const activeQualiCarriere = payments.find(
    (item) => item.expiredAt && new Date(item.expiredAt) > now,
  );

  if (!activeQualiCarriere) {
    res.json({ notAvailable: true });
    return;
  }

  next();
};

export { checkUserRole, getCvMinuteCards, checkQualiCarriere };
