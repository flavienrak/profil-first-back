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

    let cvAnonym = await prisma.cvMinute.findUnique({
      where: { id: Number(cvAnonymId) },
      include: {
        cvMinuteSections: { include: { sectionInfos: true } },
      },
    });

    if (!cvAnonym) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    let cvThequeView = await prisma.cvThequeView.findUnique({
      where: { cvMinuteId: cvAnonym.id },
    });

    if (cvThequeView) {
      cvThequeView = await prisma.cvThequeView.update({
        where: { id: cvThequeView.id },
        data: { count: { increment: 1 } },
      });
    } else {
      cvThequeView = await prisma.cvThequeView.create({
        data: {
          cvMinuteId: cvAnonym.id,
          cvThequeCritereId: Number(id),
          count: 1,
        },
      });
    }

    cvAnonym = await prisma.cvMinute.findUnique({
      where: { id: cvAnonym.id },
      include: {
        cvMinuteSections: { include: { sectionInfos: true } },
      },
    });

    const sections = await prisma.section.findMany({
      where: { id: { in: cvAnonym.cvMinuteSections.map((c) => c.sectionId) } },
    });

    res.status(200).json({ cvAnonym, sections });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
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

    if (body.competences && body.competences.length > 0) {
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
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvThequeCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let updatedCvCritere = null;
    const { cvThequeCritere } = res.locals;
    const body: {
      position?: string;
      description?: string;
      domain?: string;
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

    // Liste des champs textuels à comparer avec trim
    const textFields: (keyof typeof body)[] = [
      'position',
      'description',
      'diplome',
      'localisation',
    ];
    const valueFields: (keyof typeof body)[] = [
      'domain',
      'experience',
      'distance',
    ];

    const cvCritereData: Record<string, any> = {};
    const modifiedFields: Record<string, any> = {};

    for (const field of textFields) {
      const value = body[field];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0 && trimmed !== cvThequeCritere[field]) {
          cvCritereData[field] = trimmed;
          modifiedFields[field] = trimmed;
        }
      }
    }

    for (const field of valueFields) {
      const newValue = body[field];
      if (newValue !== undefined && newValue !== cvThequeCritere[field]) {
        cvCritereData[field] = newValue;
        modifiedFields[field] = newValue;
      }
    }

    // Mise à jour des critères simples si changement
    if (Object.keys(cvCritereData).length > 0) {
      await prisma.cvThequeCritere.update({
        where: { id: cvThequeCritere.id },
        data: cvCritereData,
      });
    }

    if (body.competences && body.competences.length > 0) {
      const trimmedCompetences = body.competences
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const existing = await prisma.cvThequeCompetence.findMany({
        where: { cvThequeCritereId: cvThequeCritere.id },
      });

      const existingContents = existing.map((e) => e.content);

      const toDelete = existing.filter(
        (e) => !trimmedCompetences.includes(e.content),
      );

      for (const item of toDelete) {
        await prisma.cvThequeCompetence.delete({ where: { id: item.id } });
      }

      for (const c of trimmedCompetences) {
        if (!existingContents.includes(c)) {
          await prisma.cvThequeCompetence.create({
            data: {
              cvThequeCritereId: cvThequeCritere.id,
              content: c,
            },
          });
        }
      }
    }

    updatedCvCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: cvThequeCritere.id },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvMinutes: true,
      },
    });

    res.status(200).json({ cvThequeCritere: updatedCvCritere });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
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
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const addCvThequeHistory = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { cvThequeCritere } = res.locals;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export {
  getCvAnonym,
  addCvThequeCritere,
  updateCvThequeCritere,
  getCvThequeHistory,
  addCvThequeHistory,
};
