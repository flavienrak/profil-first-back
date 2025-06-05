import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';

const getCvAnonym = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, cvAnonymId } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvAnonymId) },
      include: {
        cvThequeContacts: true,
        cvMinuteSections: { orderBy: { order: 'asc' } },
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    let cvThequeView = await prisma.cvThequeView.findUnique({
      where: { cvMinuteId: cvMinute.id },
    });

    if (cvThequeView) {
      cvThequeView = await prisma.cvThequeView.update({
        where: { id: cvThequeView.id },
        data: { count: { increment: 1 } },
      });
    } else {
      cvThequeView = await prisma.cvThequeView.create({
        data: {
          cvMinuteId: cvMinute.id,
          cvThequeCritereId: Number(id),
          count: 1,
        },
      });
    }

    cvMinute = await prisma.cvMinute.findUnique({
      where: { id: cvMinute.id },
      include: {
        cvThequeContacts: true,
        cvMinuteSections: { orderBy: { order: 'desc' } },
      },
    });

    res.status(200).json({ cvAnonym: cvMinute });
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

const addCvThequeCritere = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
    const body: {
      position: string;
      domain: string;
      description?: string;
      competences?: string[];
      experience?: number;
      diplome?: string;
      localisation?: string;
      distance?: number;
    } = req.body;

    const clean = (val?: string) => val?.trim() || undefined;

    const cvCritereData = {
      userId: user.id,
      position: body.position.trim(),
      domain: body.domain.trim(),
      description: clean(body.description),
      diplome: clean(body.diplome),
      localisation: clean(body.localisation),
      experience: body.experience || undefined,
      distance: body.distance || undefined,
    };

    const cvThequeCritere = await prisma.cvThequeCritere.create({
      data: cvCritereData,
    });

    if (body.competences) {
      await Promise.all(
        body.competences.map(async (item) => {
          if (item.trim().length > 0) {
            await prisma.cvThequeCompetence.create({
              data: {
                cvThequeCritereId: cvThequeCritere?.id,
                content: item.trim(),
              },
            });
          }
        }),
      );
    }

    res.status(200).json({ cvThequeCritere: { id: cvThequeCritere?.id } });
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

const getCvThequeHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { user } = res.locals;

    const history = await prisma.cvThequeCritere.findMany({
      where: { userId: user.id },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvThequeViews: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.status(200).json({ history });
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

const saveCvThequeCritere = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    let cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
    });

    if (cvThequeCritere && !cvThequeCritere.saved) {
      cvThequeCritere = await prisma.cvThequeCritere.update({
        where: { id: cvThequeCritere.id },
        data: { saved: true },
      });
    }

    res.status(200).json({ cvThequeCritere });
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

const contactCvAnonym = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
    const { cvAnonymId } = req.params;
    const body: {
      type: string;
      date: string;
      hour: number;
      minute: number;
      message: string;
    } = req.body;

    const cvAnonym = await prisma.cvMinute.findUnique({
      where: { id: Number(cvAnonymId) },
    });

    if (!cvAnonym) {
      res.json({ cvAnonymNotFound: true });
      return;
    }

    let cvThequeContact = await prisma.cvThequeContact.findUnique({
      where: {
        recruiterId_cvMinuteId: {
          recruiterId: user.id,
          cvMinuteId: cvAnonym.id,
        },
      },
    });

    if (!cvThequeContact) {
      cvThequeContact = await prisma.cvThequeContact.create({
        data: {
          ...body,
          userId: cvAnonym.userId,
          recruiterId: user.id,
          cvMinuteId: cvAnonym.id,
        },
      });
    }

    res.status(201).json({ cvThequeContact });
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

export {
  getCvAnonym,
  addCvThequeCritere,
  getCvThequeHistory,
  saveCvThequeCritere,
  contactCvAnonym,
};
