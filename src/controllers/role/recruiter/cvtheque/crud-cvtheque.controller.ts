import express from 'express';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';

const prisma = new PrismaClient();

const getCvCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const cvCritere = await prisma.cvCritere.findUnique({
      where: { id: Number(id) },
      include: { cvCritereCompetences: true },
    });

    res.status(200).json({ cvCritere });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const addCvCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvCritere = null;
    const { user } = res.locals;
    const body: {
      position: string;
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

    const cvCritereData: {
      userId: number;
      position: string;
      description?: string;
      experience?: number;
      diplome?: string;
      localisation?: string;
      distance?: number;
    } = {
      userId: user.id,
      position: body.position,
    };

    if (body.description && body.description.trim().length > 0) {
      cvCritereData.description = body.description.trim();
    }
    if (body.experience) {
      cvCritereData.experience = body.experience;
    }
    if (body.diplome && body.diplome.trim().length > 0) {
      cvCritereData.diplome = body.diplome.trim();
    }
    if (body.localisation && body.localisation.trim().length > 0) {
      cvCritereData.localisation = body.localisation.trim();
    }
    if (body.distance) {
      cvCritereData.distance = body.distance;
    }

    cvCritere = await prisma.cvCritere.create({
      data: cvCritereData,
    });

    if (body.competences && body.competences.length > 0) {
      for (const c of body.competences) {
        if (c.trim().length > 0) {
          await prisma.cvCritereCompetence.create({
            data: {
              cvCritereId: cvCritere.id,
              content: c.trim(),
            },
          });
        }
      }
    }

    res.status(200).json({ cvCritere: { id: cvCritere.id } });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let updatedCvCritere = null;
    const { user, cvCritere } = res.locals;
    const body: {
      position: string;
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

    const cvCritereData: {
      userId: number;
      position: string;
      description?: string;
      experience?: number;
      diplome?: string;
      localisation?: string;
      distance?: number;
    } = {
      userId: user.id,
      position: body.position,
    };

    if (body.description && body.description.trim().length > 0) {
      cvCritereData.description = body.description.trim();
    }
    if (body.experience) {
      cvCritereData.experience = body.experience;
    }
    if (body.diplome && body.diplome.trim().length > 0) {
      cvCritereData.diplome = body.diplome.trim();
    }
    if (body.localisation && body.localisation.trim().length > 0) {
      cvCritereData.localisation = body.localisation.trim();
    }
    if (body.distance) {
      cvCritereData.distance = body.distance;
    }

    updatedCvCritere = await prisma.cvCritere.update({
      where: { id: cvCritere.id },
      data: cvCritereData,
    });

    if (body.competences && body.competences.length > 0) {
      const trimmedCompetences = body.competences
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const existing = await prisma.cvCritereCompetence.findMany({
        where: { cvCritereId: cvCritere.id },
      });

      const existingContents = existing.map((e) => e.content);

      const toDelete = existing.filter(
        (e) => !trimmedCompetences.includes(e.content),
      );

      for (const item of toDelete) {
        await prisma.cvCritereCompetence.delete({ where: { id: item.id } });
      }

      for (const c of trimmedCompetences) {
        if (!existingContents.includes(c)) {
          await prisma.cvCritereCompetence.create({
            data: {
              cvCritereId: cvCritere.id,
              content: c,
            },
          });
        }
      }
    }

    updatedCvCritere = await prisma.cvCritere.findUnique({
      where: { id: cvCritere.id },
      include: { cvCritereCompetences: true },
    });

    res.status(200).json({ cvCritere: updatedCvCritere });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { getCvCritere, addCvCritere, updateCvCritere };
