import express from 'express';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';

const prisma = new PrismaClient();

const getCvAnonym = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id, cvAnonymId } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvAnonymId) },
      include: {
        cvMinuteSections: { include: { sectionInfos: true } },
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
        cvMinuteSections: { include: { sectionInfos: true } },
      },
    });

    const sections = await prisma.section.findMany({
      where: { id: { in: cvMinute?.cvMinuteSections.map((c) => c.sectionId) } },
    });

    res.status(200).json({ cvAnonym: cvMinute, sections });
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
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvThequeCritere = null;
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

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

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

    cvThequeCritere = await prisma.cvThequeCritere.create({
      data: cvCritereData,
    });

    if (body.competences) {
      for (const c of body.competences) {
        if (c.trim().length > 0) {
          await prisma.cvThequeCompetence.create({
            data: {
              cvThequeCritereId: cvThequeCritere.id,
              content: c.trim(),
            },
          });
        }
      }
    }

    res.status(200).json({ cvThequeCritere: { id: cvThequeCritere.id } });
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
  req: express.Request,
  res: express.Response,
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
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    let cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
    });

    if (!cvThequeCritere) {
      res.json({ cvThequeCritereNotFound: true });
      return;
    }

    if (!cvThequeCritere.saved) {
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

export {
  getCvAnonym,
  addCvThequeCritere,
  getCvThequeHistory,
  saveCvThequeCritere,
};
