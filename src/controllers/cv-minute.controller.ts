import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import isEmpty from '../utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { defaultSections, imageMimeTypes } from '../utils/constants';

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
      include: { sectionInfos: true, advices: true },
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
    const userId = res.locals.user.id;
    const body: { position: string } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvMinute = await prisma.cvMinute.create({
      data: {
        position: body.position.trim(),
        userId,
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
      const fileName = `cv-${userId}-${Date.now()}-${uniqueId}${extension}`;
      const directoryPath = path.join(
        __dirname,
        `../uploads/files/user-${userId}`,
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
          userId,
          cvMinuteId: cvMinute.id,
        },
      });
    }

    for (const s of defaultSections) {
      let section = await prisma.section.findUnique({
        where: { name: s.name.trim().toLowerCase() },
      });

      if (!section) {
        section = await prisma.section.create({
          data: { name: s.name.trim().toLowerCase(), editable: s.editable },
        });
      }

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

const updateCvMinuteProfile = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let file = null;
    let sectionInfo = null;
    let cvMinuteSection = null;
    const userId = res.locals.user.id;
    const { id } = req.params;
    const body: {
      cvMinuteSectionId: number | string;
      sectionInfoId?: number | string;
    } = req.body;

    if (
      isNaN(Number(body.cvMinuteSectionId)) ||
      (body.sectionInfoId && isNaN(Number(body.sectionInfoId)))
    ) {
      res.json({ invalidId: true });
      return;
    }

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: Number(body.cvMinuteSectionId) },
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
      const directoryPath = path.join(
        __dirname,
        `../uploads/files/user-${userId}`,
      );

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
      include: { sectionInfos: true },
    });
    res.status(200).json({ cvMinuteSection, file });
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
    let section = null;
    let cvMinuteSection = null;
    const { id } = req.params;
    const body: {
      sectionId?: number;
      sectionInfoId?: number;

      sectionOrder?: number;
      sectionTitle?: string;

      order?: number;
      role?: string;
      title?: string;
      content?: string;
      company?: string;
      date?: string;
      contrat?: string;
      conseil?: string;
      suggestion?: string;

      cvMinuteSectionId?: number;
    } = req.body;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(id) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    if (body.cvMinuteSectionId) {
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });

      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      }
    }

    if (body.sectionTitle) {
      section = await prisma.section.findUnique({
        where: { name: body.sectionTitle.trim().toLocaleLowerCase() },
      });

      if (!section) {
        section = await prisma.section.create({
          data: {
            name: body.sectionTitle.trim().toLocaleLowerCase(),
            editable: true,
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: cvMinute.id,
            sectionId: section.id,
            sectionTitle: body.sectionTitle,
            sectionOrder: body.sectionOrder,
          },
        });
      }
    }

    // if (!section) {
    //   section = await prisma.section.create({
    //     data: { name: s.name.trim().toLowerCase(), editable: s.editable },
    //   });

    //   const cvMinuteSection = await prisma.cvMinuteSection.create({
    //     data: {
    //       cvMinuteId: cvMinute.id,
    //       sectionId: section.id,
    //       sectionOrder: s.order,
    //       sectionTitle: s.title?.trim(),
    //     },
    //   });
    // data: { sectionTitle: body.sectionTitle.trim() },

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
      await prisma.sectionInfo.update({
        where: { id: body.sectionInfoId },
        data: infosToUpdate,
      });
    } else {
      await prisma.sectionInfo.create({
        data: {
          ...infosToUpdate,
          cvMinuteSectionId: cvMinuteSection.id,
        },
      });
    }

    cvMinuteSection = await prisma.cvMinuteSection.findUnique({
      where: { id: cvMinuteSection.id },
      include: { sectionInfos: true, advices: true },
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
  updateCvMinuteProfile,
  addSections,
  updateSection,
  updateSectionsOrder,
};
