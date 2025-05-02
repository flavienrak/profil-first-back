import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';

import { PrismaClient } from '@prisma/client';
import { formattedDate, imageMimeTypes } from '../../../../utils/constants';
import { SectionInfoInterface } from '../../../../interfaces/role/user/cv-minute/sectionInfo.interface';

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
      include: {
        advices: true,
        evaluation: true,
        cvMinuteSections: {
          include: {
            sectionInfos: { include: { evaluation: true, advices: true } },
            advices: true,
          },
        },
      },
    });

    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const files = await prisma.file.findMany({
      where: { cvMinuteId: cvMinute.id },
    });

    const sections = await prisma.section.findMany({
      where: { id: { in: cvMinute.cvMinuteSections.map((c) => c.sectionId) } },
    });

    res.status(200).json({
      cvMinute,
      files,
      sections,
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
      include: {
        advices: true,
        evaluation: true,
        files: true,
        cvMinuteSections: {
          include: {
            sectionInfos: {
              include: {
                advices: true,
                evaluation: true,
              },
            },
          },
        },
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

    // Copier les sections, infos, conseils et évaluations
    await Promise.all(
      cvMinute.cvMinuteSections.map(async (section) => {
        const newSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: newCvMinute.id,
            sectionId: section.sectionId,
            sectionOrder: section.sectionOrder,
            sectionTitle: section.sectionTitle,
          },
        });

        await Promise.all(
          section.sectionInfos.map(async (info) => {
            const newInfo = await prisma.sectionInfo.create({
              data: {
                cvMinuteSectionId: newSection.id,
                title: info.title,
                content: info.content,
                date: info.date,
                company: info.company,
                contrat: info.contrat,
                icon: info.icon,
                iconSize: info.iconSize,
                order: info.order,
              },
            });

            // Copier les conseils
            if (info.advices.length > 0) {
              await prisma.advice.createMany({
                data: info.advices.map((adv) => ({
                  sectionInfoId: newInfo.id,
                  content: adv.content,
                  type: adv.type,
                })),
              });
            }

            // Copier l’évaluation
            if (info.evaluation) {
              await prisma.evaluation.create({
                data: {
                  sectionInfoId: newInfo.id,
                  initialScore: info.evaluation.initialScore,
                  actualScore: info.evaluation.actualScore,
                  content: info.evaluation.content,
                  weakContent: info.evaluation.weakContent,
                },
              });
            }
          }),
        );
      }),
    );

    res.status(200).json({ cvMinute: { id: newCvMinute.id } });
    return;
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const { id } = req.params;
    const body: { name: string } = req.body;

    let cvMinute = await prisma.cvMinute.update({
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
    const { id } = req.params;

    let cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });

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
    let sectionInfo: SectionInfoInterface = null;
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

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
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

    let file = await prisma.file.findUnique({
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
    const body: { sectionInfoId: number; targetSectionInfoId: number } =
      req.body;

    let section = await prisma.sectionInfo.findUnique({
      where: { id: body.sectionInfoId },
      select: { id: true, order: true },
    });
    let targetSection = await prisma.sectionInfo.findUnique({
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
    const body: { cvMinuteSectionId: number; targetCvMinuteSectionId: number } =
      req.body;

    let cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: body.cvMinuteSectionId },
      select: { id: true, sectionOrder: true },
    });
    let targetCvMinuteSection = await prisma.cvMinuteSection.findUnique({
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
