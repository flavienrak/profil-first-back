import express from 'express';

import { PrismaClient } from '@prisma/client';
import { domains } from '@/utils/constants';

const prisma = new PrismaClient();

const getUsers = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { domainId } = req.params;

    const filterId = Number(domainId);
    let filterLabel: string | null = null;

    if (!isNaN(filterId)) {
      const foundDomain = domains.find((d) => d.id === filterId);
      filterLabel = foundDomain?.label ?? null;
    }

    const users = await prisma.user.findMany({
      where: {
        role: 'user',
        ...(filterLabel && {
          cvMinuteDomains: { some: { content: filterLabel } },
        }),
      },
      include: {
        cvMinuteDomains: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.status(200).json({ users });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

const getUserCvMinutes = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { crossSourcingUser } = res.locals;

    const cvMinutes = await prisma.cvMinute.findMany({
      where: {
        userId: crossSourcingUser.id,
        qualiCarriereRef: false,
        generated: null,
      },
    });

    res.status(200).json({ cvMinutes });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

const getUserCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { cvMinuteId } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvMinuteId) },
      include: {
        cvMinuteSections: {
          include: { files: true },
          orderBy: { order: 'desc' },
        },
      },
    });

    res.status(200).json({ cvMinute });
    return;
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

export { getUsers, getUserCvMinutes, getUserCvMinute };
