import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { domains } from '@/utils/constants';
import { UserInterface } from '@/interfaces/user.interface';

const getUsers = async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    const filterId = Number(domainId);
    let filterLabel: string | null = null;

    if (domainId !== 'all') {
      if (!isNaN(Number(filterId))) {
        const foundDomain = domains.find((d) => d.id === filterId);
        filterLabel = foundDomain?.label ?? null;
      }

      if (!filterLabel) {
        res.json({ invalidFilter: true });
        return;
      }
    }

    const users = await prisma.user.findMany({
      where: {
        role: 'candidat',
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

const getUserCvMinutes = async (req: Request, res: Response) => {
  try {
    const { crossSourcingUser } = res.locals as {
      crossSourcingUser: UserInterface;
    };

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

const getUserCvMinute = async (req: Request, res: Response) => {
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
