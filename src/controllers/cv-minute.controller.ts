import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import isEmpty from '../utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { defaultSections } from '../utils/constants';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

const getCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
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

    const sections = await prisma.section.findMany({
      where: { id: { in: cvMinuteSections.map((c) => c.sectionId) } },
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

const addCvMinute = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const body: { position: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvMinute = await prisma.cvMinute.create({
      data: {
        position: body.position.trim(),
        userId: res.locals.user.id,
      },
    });

    // MIME type
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidDocument: true });
      return;
    } else {
      const extension = path.extname(req.file.originalname);
      const fileName = `cv-${res.locals.user.id}-${Date.now()}-${uniqueId}${extension}`;
      const directoryPath = path.join(
        __dirname,
        `../uploads/files/user-${res.locals.user.id}`,
      );
      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      await prisma.file.create({
        data: {
          name: fileName,
          extension,
          originalName: req.file.originalname,
          usage: 'cv',
          userId: res.locals.user.id,
          cvMinuteId: cvMinute.id,
        },
      });
    }

    for (const s of defaultSections) {
      const section = await prisma.section.findUnique({
        where: { name: s.name.trim() },
      });

      await prisma.cvMinuteSection.create({
        data: {
          cvMinuteId: cvMinute.id,
          sectionId: section.id,
          sectionOrder: s.order,
          sectionTitle: s.title?.trim(),
        },
      });
    }

    res.status(201).json({ cvMinuteId: cvMinute.id });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const addSections = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const sections = [];
    const cvMinuteSections = [];
    const { id } = req.params;
    const body: {
      sections: {
        name: string;
        title?: string;
        order?: number;
        editable?: boolean;
      }[];
    } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    for (const s of body.sections) {
      let section = await prisma.section.findUnique({
        where: { name: s.name.trim() },
      });

      if (!section) {
        section = await prisma.section.create({
          data: { name: s.name.trim().toLowerCase(), editable: s.editable },
        });

        const cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: cvMinute.id,
            sectionId: section.id,
            sectionOrder: s.order,
            sectionTitle: s.title?.trim(),
          },
        });

        cvMinuteSections.push(cvMinuteSection);
        sections.push(section);
      }
    }

    res.status(201).json({ sections, cvMinuteSections });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSection = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvMinuteSection = null;
    let sectionInfo = null;
    const { id } = req.params;
    const body: {
      sectionId: number;
      sectionInfoId: number;
      role?: string;
      content?: string;
      sectionTitle?: string;
      title?: string;
      company?: string;
      date?: string;
      contrat?: string;
      conseil?: string;
      suggestion?: string;
    } = req.body;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    if (body.sectionTitle) {
      cvMinuteSection = await prisma.cvMinuteSection.update({
        where: {
          cvMinuteId_sectionId: {
            cvMinuteId: cvMinute.id,
            sectionId: body.sectionId,
          },
        },
        data: { sectionTitle: body.sectionTitle.trim() },
      });
    }

    const infosToUpdate: {
      role?: string;
      content?: string;
      title?: string;
      company?: string;
      date?: string;
      contrat?: string;
      conseil?: string;
      suggestion?: string;
    } = {};

    if (body.role) {
      infosToUpdate.role = body.role.trim();
    }
    if (body.content) {
      infosToUpdate.content = body.content.trim();
    }
    if (body.title) {
      infosToUpdate.title = body.title.trim();
    }
    if (body.company) {
      infosToUpdate.company = body.company.trim();
    }
    if (body.date) {
      infosToUpdate.date = body.date.trim();
    }
    if (body.contrat) {
      infosToUpdate.contrat = body.contrat.trim();
    }
    if (body.conseil) {
      infosToUpdate.conseil = body.conseil.trim();
    }
    if (body.suggestion) {
      infosToUpdate.suggestion = body.suggestion.trim();
    }

    if (isEmpty(infosToUpdate)) {
      res.json({ invalidData: true });
      return;
    }

    if (body.sectionInfoId) {
      sectionInfo = await prisma.sectionInfo.update({
        where: { id: body.sectionInfoId },
        data: infosToUpdate,
      });
    } else {
      sectionInfo = await prisma.sectionInfo.create({
        data: {
          ...infosToUpdate,
          cvMinuteId: cvMinute.id,
          sectionId: body.sectionId,
        },
      });
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: {
        cvMinuteId_sectionId: {
          cvMinuteId: cvMinute.id,
          sectionId: body.sectionId,
        },
      },
      include: { sectionInfos: true },
    });

    res.status(200).json({ cvMinuteSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSectionsOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const body: { sections: { id: number; order: number }[] } = req.body;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const cvMinuteSections = await Promise.all(
      body.sections.map((data) =>
        prisma.cvMinuteSection.update({
          where: {
            cvMinuteId_sectionId: {
              cvMinuteId: cvMinute.id,
              sectionId: data.id,
            },
          },
          data: { sectionOrder: data.order },
        }),
      ),
    );

    res.status(20).json({ cvMinuteSections });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export {
  getCvMinute,
  addCvMinute,
  addSections,
  updateSection,
  updateSectionsOrder,
};
