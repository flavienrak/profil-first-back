import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';

import { PrismaClient } from '@prisma/client';
import { formattedDate, imageMimeTypes } from '../../../utils/constants';
import { CvMinuteSectionInterface } from '../../../interfaces/cv-minute/cvMinuteSection.interface';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

const getCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id), qualiCarriereRef: false },
      include: { advices: true, evaluation: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const files = await prisma.file.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
        advices: true,
      },
    });

    const sections = await prisma.section.findMany({
      where: {
        id: {
          in: cvMinuteSections.map(
            (c: CvMinuteSectionInterface) => c.sectionId,
          ),
        },
      },
    });

    res.status(200).json({
      cvMinute,
      files,
      sections,
      cvMinuteSections,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
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
      include: { advices: true, evaluation: true },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const files = await prisma.file.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: { sectionInfos: true },
    });

    // CREATE COPY CVMINUTE
    const name = `CV COPY du ${formattedDate}`;
    const newCvMinute = await prisma.cvMinute.create({
      data: {
        position: cvMinute.position,
        name: name,
        primaryBg: cvMinute.primaryBg,
        secondaryBg: cvMinute.secondaryBg,
        tertiaryBg: cvMinute.tertiaryBg,
        userId: cvMinute.userId,
        visible: cvMinute.visible,
      },
    });

    const cvMinuteAdvices = await prisma.advice.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    // CREATE COPY ADVICES
    if (cvMinuteAdvices.length > 0) {
      for (const a of cvMinuteAdvices) {
        await prisma.advice.create({
          data: {
            cvMinuteId: newCvMinute.id,
            content: a.content,
            type: a.type,
          },
        });
      }
    }

    // CREATE COPY EVALUATION
    const cvMinuteEvaluation = await prisma.evaluation.findUnique({
      where: { cvMinuteId: cvMinute.id },
    });
    if (cvMinuteEvaluation) {
      await prisma.evaluation.create({
        data: {
          cvMinuteId: newCvMinute.id,
          initialScore: cvMinuteEvaluation.initialScore,
          actualScore: cvMinuteEvaluation.actualScore,
          content: cvMinuteEvaluation.content,
        },
      });
    }

    // CREATE COPY CVMINUTESECTION & SECTIONINFO & ADVICE & EVALUATION
    for (const s of cvMinuteSections) {
      const newCvMinuteSection = await prisma.cvMinuteSection.create({
        data: {
          cvMinuteId: newCvMinute.id,
          sectionId: s.sectionId,
          sectionOrder: s.sectionOrder,
          sectionTitle: s.sectionTitle,
        },
      });

      for (const sInfo of s.sectionInfos) {
        const newSectionInfo = await prisma.sectionInfo.create({
          data: {
            cvMinuteSectionId: newCvMinuteSection.id,
            title: sInfo.title,
            content: sInfo.content,
            date: sInfo.date,
            company: sInfo.company,
            contrat: sInfo.contrat,
            icon: sInfo.icon,
            iconSize: sInfo.iconSize,
            order: sInfo.order,
          },
        });

        const sectionInfoAdvices = await prisma.advice.findMany({
          where: { sectionInfoId: sInfo.id },
        });

        if (sectionInfoAdvices.length > 0) {
          for (const sAdvice of sectionInfoAdvices) {
            await prisma.advice.create({
              data: {
                sectionInfoId: newSectionInfo.id,
                content: sAdvice.content,
                type: 'advice',
              },
            });
          }
        }

        const sectionInfoEvaluation = await prisma.evaluation.findUnique({
          where: { sectionInfoId: sInfo.id },
        });

        if (sectionInfoEvaluation) {
          await prisma.evaluation.create({
            data: {
              sectionInfoId: newSectionInfo.id,
              initialScore: sectionInfoEvaluation.initialScore,
              actualScore: sectionInfoEvaluation.actualScore,
              content: sectionInfoEvaluation.content,
              weakContent: sectionInfoEvaluation.weakContent,
            },
          });
        }
      }
    }

    // CREATE COPY FILES
    for (const f of files) {
      await prisma.file.create({
        data: {
          name: f.name,
          extension: f.extension,
          originalName: f.originalName,
          usage: 'cv',
          userId: user.id,
          cvMinuteId: newCvMinute.id,
        },
      });
    }

    res.status(200).json({ cvMinute: { id: newCvMinute.id } });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
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
      where: { userId: user.id, qualiCarriereRef: false },
      orderBy: { updatedAt: 'desc' },
    });

    res.status(200).json({ cvMinutes });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteName = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvMinute = null;
    const { id } = req.params;
    const body: { name: string } = req.body;

    cvMinute = await prisma.cvMinute.update({
      where: { id: Number(id) },
      data: { name: body.name },
    });

    res.status(200).json({
      cvMinute: { id: cvMinute.id, name: cvMinute.name },
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteVisibility = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvMinute = null;
    const { id } = req.params;

    cvMinute = await prisma.cvMinute.findUnique({ where: { id: Number(id) } });

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

    res.status(200).json({
      cvMinute: { id: cvMinute.id, visible: cvMinute.visible },
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteProfile = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let file = null;
    let sectionInfo = null;
    let cvMinuteSection = null;
    const userId = res.locals.user.id;
    const body: {
      cvMinuteSectionId: number | string;
      sectionInfoId?: number | string;
    } = req.body;
    const { cvMinute } = res.locals;

    if (
      isNaN(Number(body.cvMinuteSectionId)) ||
      (body.sectionInfoId && isNaN(Number(body.sectionInfoId)))
    ) {
      res.json({ invalidId: true });
      return;
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(body.cvMinuteSectionId) },
      select: { id: true },
    });

    if (!cvMinuteSection) {
      res.json({ cvMinuteSectionNotFound: true });
      return;
    }

    if (body.sectionInfoId) {
      sectionInfo = await prisma.sectionInfo.findUnique({
        where: { id: Number(body.sectionInfoId) },
        select: { id: true },
      });

      if (!sectionInfo) {
        res.json({ sectionInfoNotFound: true });
        return;
      }
    } else {
      sectionInfo = await prisma.sectionInfo.create({
        data: {
          cvMinuteSectionId: cvMinuteSection.id,
          content: 'cv-profile',
          order: 1,
        },
      });
    }

    file = await prisma.file.findUnique({
      where: { sectionInfoId: sectionInfo.id },
    });

    if (!imageMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidFormat: true });
      return;
    } else {
      const extension = path.extname(req.file.originalname);
      const fileName = `cv-profile-${userId}-${Date.now()}-${uniqueId}${extension}`;
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(uploadsBase, `/files/user-${userId}`);

      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      if (file) {
        const filePath = path.join(directoryPath, file.name);
        fs.unlinkSync(filePath);

        file = await prisma.file.update({
          where: { id: file.id },
          data: {
            name: fileName,
            extension,
            originalName: req.file.originalname,
          },
        });
      } else {
        file = await prisma.file.create({
          data: {
            name: fileName,
            extension,
            originalName: req.file.originalname,
            usage: 'cv-profile',
            userId,
            cvMinuteId: cvMinute.id,
            sectionInfoId: sectionInfo.id,
          },
        });
      }
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: {
        sectionInfos: { include: { evaluation: true, advices: true } },
      },
    });
    res.status(200).json({ cvMinuteSection, file });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSectionInfoOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let section = null;
    let targetSection = null;
    const body: { sectionInfoId: number; targetSectionInfoId: number } =
      req.body;

    section = await prisma.sectionInfo.findUnique({
      where: { id: body.sectionInfoId },
      select: { id: true, order: true },
    });
    targetSection = await prisma.sectionInfo.findUnique({
      where: { id: body.targetSectionInfoId },
      select: { id: true, order: true },
    });

    const tempOrder = section.order;
    section = await prisma.sectionInfo.update({
      where: { id: section.id },
      data: { order: targetSection.order },
    });
    targetSection = await prisma.sectionInfo.update({
      where: { id: targetSection.id },
      data: { order: tempOrder },
    });

    res.status(200).json({ section, targetSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateCvMinuteSectionOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvMinuteSection = null;
    let targetCvMinuteSection = null;
    const body: { cvMinuteSectionId: number; targetCvMinuteSectionId: number } =
      req.body;

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.cvMinuteSectionId },
      select: { id: true, sectionOrder: true },
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.targetCvMinuteSectionId },
      select: { id: true, sectionOrder: true },
    });

    const tempOrder = cvMinuteSection.sectionOrder;
    cvMinuteSection = await prisma.cvMinuteSection.update({
      where: { id: cvMinuteSection.id },
      data: { sectionOrder: targetCvMinuteSection.sectionOrder },
    });
    targetCvMinuteSection = await prisma.cvMinuteSection.update({
      where: { id: targetCvMinuteSection.id },
      data: { sectionOrder: tempOrder },
    });

    res.status(200).json({ cvMinuteSection, targetCvMinuteSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const deleteSectionInfo = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { sectionInfoId } = req.params;

    if (!sectionInfoId || isNaN(Number(sectionInfoId))) {
      res.json({ invalidSectionInfoId: true });
      return;
    }
    const section = await prisma.sectionInfo.delete({
      where: { id: Number(sectionInfoId) },
    });

    res.status(200).json({ section });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
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
    res.status(500).json({ error: `${error.message}` });
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
  updateSectionInfoOrder,
  updateCvMinuteSectionOrder,
  deleteSectionInfo,
  deleteCvMinuteSection,
};
