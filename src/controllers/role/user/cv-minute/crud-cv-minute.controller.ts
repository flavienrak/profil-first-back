import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';

import { PrismaClient } from '@prisma/client';
import { formattedDate, imageMimeTypes } from '@/utils/constants';
import { FileInterface } from '@/interfaces/file.interface';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

const getCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: {
        id: Number(id),
        qualiCarriereRef: false,
        cvThequeCritereId: null,
      },
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: { include: { advices: true } },
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const files = await prisma.file.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    res.status(200).json({ cvMinute, files });
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

const copyCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { user } = res.locals;
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id), qualiCarriereRef: false },
      include: {
        advices: true,
        evaluation: true,
        files: true,
        cvMinuteSections: { include: { advices: true, evaluation: true } },
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    // Créer nouveau cvMinute
    const newCvMinute = await prisma.cvMinute.create({
      data: {
        position: cvMinute.position,
        name: `CV COPY du ${formattedDate}`,
        primaryBg: cvMinute.primaryBg,
        secondaryBg: cvMinute.secondaryBg,
        tertiaryBg: cvMinute.tertiaryBg,
        userId: cvMinute.userId,
        visible: cvMinute.visible,
      },
    });

    // Copier les fichiers
    if (cvMinute.files.length > 0) {
      await prisma.file.createMany({
        data: cvMinute.files.map((f) => ({
          name: f.name,
          extension: f.extension,
          originalName: f.originalName,
          usage: 'cv',
          userId: user.id,
          cvMinuteId: newCvMinute.id,
        })),
      });
    }

    // Copier les conseils liés au cvMinute
    if (cvMinute.advices.length > 0) {
      await prisma.advice.createMany({
        data: cvMinute.advices.map((a) => ({
          cvMinuteId: newCvMinute.id,
          content: a.content,
          type: a.type,
        })),
      });
    }

    // Copier l’évaluation du cvMinute
    if (cvMinute.evaluation) {
      await prisma.evaluation.create({
        data: {
          cvMinuteId: newCvMinute.id,
          initialScore: cvMinute.evaluation.initialScore,
          actualScore: cvMinute.evaluation.actualScore,
          content: cvMinute.evaluation.content,
        },
      });
    }

    // COPY CVMINUTE SECTION, ADVICE & EVALUATION
    await Promise.all(
      cvMinute.cvMinuteSections.map(async (section) => {
        const cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            name: section.name,
            title: section.title,
            content: section.content,
            date: section.date,
            company: section.company,
            contrat: section.contrat,
            icon: section.icon,
            iconSize: section.iconSize,
            order: section.order,
            cvMinuteId: newCvMinute.id,
          },
        });

        // COPY ADVICE
        if (section.advices.length > 0) {
          await prisma.advice.createMany({
            data: section.advices.map((item) => ({
              content: item.content,
              type: item.type,
              cvMinuteSectionId: cvMinuteSection.id,
            })),
          });
        }

        // COPY EVALUATION
        if (section.evaluation) {
          await prisma.evaluation.create({
            data: {
              initialScore: section.evaluation.initialScore,
              actualScore: section.evaluation.actualScore,
              content: section.evaluation.content,
              weakContent: section.evaluation.weakContent,
              cvMinuteSectionId: cvMinuteSection.id,
            },
          });
        }
      }),
    );

    res.status(200).json({ cvMinute: { id: newCvMinute.id } });
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

const getAllCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { user } = res.locals;
    const cvMinutes = await prisma.cvMinute.findMany({
      where: {
        userId: user.id,
        qualiCarriereRef: false,
        cvThequeCritereId: null,
      },
      orderBy: { updatedAt: 'desc' },
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

const updateCvMinuteName = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const body: { name: string } = req.body;

    let cvMinute = await prisma.cvMinute.update({
      where: { id: Number(id) },
      data: { name: body.name },
    });

    res
      .status(200)
      .json({ cvMinute: { id: cvMinute.id, name: cvMinute.name } });
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

const updateCvMinuteVisibility = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    if (cvMinute.visible) {
      cvMinute = await prisma.cvMinute.update({
        where: { id: Number(id) },
        data: { visible: false },
      });
    } else {
      cvMinute = await prisma.cvMinute.update({
        where: { id: Number(id) },
        data: { visible: true },
      });
    }

    res
      .status(200)
      .json({ cvMinute: { id: cvMinute.id, visible: cvMinute.visible } });
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

const updateCvMinuteProfile = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let file: FileInterface | null = null;

    const { user } = res.locals;
    const { cvMinute } = res.locals;
    const body: { cvMinuteSectionId: number | string } = req.body;

    if (isNaN(Number(body.cvMinuteSectionId))) {
      res.json({ invalidId: true });
      return;
    }

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(body.cvMinuteSectionId) },
      select: { id: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    if (!req.file) {
      res.json({ fileNotFound: true });
      return;
    } else if (!imageMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidFormat: true });
      return;
    } else {
      const extension = path.extname(req.file.originalname);
      const fileName = `cvMinute-profile-${user.id}-${Date.now()}-${uniqueId}${extension}`;
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(uploadsBase, `/files/user-${user.id}`);

      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      file = await prisma.file.create({
        data: {
          name: fileName,
          extension,
          originalName: req.file.originalname,
          usage: 'cvMinute-profile',
          userId: user.id,
          cvMinuteId: cvMinute.id,
          cvMinuteSectionId: cvMinuteSection.id,
        },
      });
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: { evaluation: true, advices: true },
    });
    res.status(200).json({ cvMinuteSection, file });
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

const updateCvMinuteSectionOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const body: { cvMinuteSectionId: number; targetCvMinuteSectionId: number } =
      req.body;

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.cvMinuteSectionId },
      select: { id: true, order: true },
    });
    let targetCvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.targetCvMinuteSectionId },
      select: { id: true, order: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    } else if (!targetCvMinuteSection) {
      res.json({ targetCvMinuteSectionNotFound: true });
      return;
    }

    const tempOrder = cvMinuteSection.order;
    cvMinuteSection = await prisma.cvMinuteSection.update({
      where: { id: cvMinuteSection.id },
      data: { order: targetCvMinuteSection.order },
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.update({
      where: { id: targetCvMinuteSection.id },
      data: { order: tempOrder },
    });

    res.status(200).json({ cvMinuteSection, targetCvMinuteSection });
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

const deleteCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { cvMinuteSectionId } = req.params;

    if (!cvMinuteSectionId || isNaN(Number(cvMinuteSectionId))) {
      res.json({ invalidCvMinuteSectionId: true });
      return;
    }
    const cvMinuteSection = await prisma.cvMinuteSection.delete({
      where: { id: Number(cvMinuteSectionId) },
    });

    res.status(200).json({ cvMinuteSection });
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
  getCvMinute,
  copyCvMinute,
  getAllCvMinute,
  updateCvMinuteName,
  updateCvMinuteVisibility,
  updateCvMinuteProfile,
  updateCvMinuteSectionOrder,
  deleteCvMinuteSection,
};
