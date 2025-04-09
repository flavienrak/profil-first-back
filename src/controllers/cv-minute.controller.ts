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
      include: { advices: true },
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

const updateCvMinuteSection = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let section = null;
    let cvMinuteSection = null;
    let sectionInfo = null;

    const { id } = req.params;
    const body: {
      sectionOrder?: number;
      sectionTitle?: string;
      sectionInfoId?: number;
      sectionInfoOrder?: number;

      icon?: string;
      iconSize?: number;
      role?: string;
      title?: string;
      content?: string;
      company?: string;
      date?: string;
      contrat?: string;

      newSection?: boolean;
      updateExperience?: boolean;
      updateContactSection?: boolean;
      updateCvMinuteSection?: boolean;

      cvMinuteSectionId?: number;
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

    // (create | update) contact
    if (body.updateContactSection) {
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });

      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      }

      const infosToUpdate = {
        content: body.content.trim(),
        icon: body.icon.trim(),
        iconSize: body.iconSize,
        order: body.sectionInfoOrder,
      };

      // (update | create) sectionInfo
      if (body.sectionInfoId) {
        sectionInfo = await prisma.sectionInfo.update({
          where: { id: body.sectionInfoId },
          data: infosToUpdate,
        });
      } else {
        sectionInfo = await prisma.sectionInfo.create({
          data: { cvMinuteSectionId: body.cvMinuteSectionId, ...infosToUpdate },
        });
      }
    }

    if (body.newSection) {
      // create (section &| cvMinuteSection) & sectionInfo
      section = await prisma.section.findUnique({
        where: { name: body.title.trim().toLocaleLowerCase() },
      });

      if (section) {
        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: {
            cvMinuteId_sectionId: {
              cvMinuteId: cvMinute.id,
              sectionId: section.id,
            },
          },
        });

        if (cvMinuteSection) {
          res.json({ sectionAlreadyExist: true });
          return;
        } else {
          // create cvMinuteSection & sectionInfo
          cvMinuteSection = await prisma.cvMinuteSection.create({
            data: {
              cvMinuteId: cvMinute.id,
              sectionId: section.id,
              sectionTitle: body.title.trim(),
              sectionOrder: body.sectionOrder,
            },
          });

          sectionInfo = await prisma.sectionInfo.create({
            data: {
              cvMinuteSectionId: cvMinuteSection.id,
              content: body.content.trim(),
            },
          });

          cvMinuteSection = await prisma.cvMinuteSection.findUnique({
            where: { id: cvMinuteSection.id },
            include: { sectionInfos: true },
          });

          res.status(201).json({ cvMinuteSection });
          return;
        }
      } else {
        // create section & cvMinute & sectionInfo
        section = await prisma.section.create({
          data: {
            name: body.title.trim().toLocaleLowerCase(),
            editable: true,
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: cvMinute.id,
            sectionId: section.id,
            sectionTitle: body.title.trim(),
            sectionOrder: body.sectionOrder,
          },
        });

        sectionInfo = await prisma.sectionInfo.create({
          data: {
            cvMinuteSectionId: cvMinuteSection.id,
            content: body.content.trim(),
          },
        });

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: { sectionInfos: true },
        });

        res.status(201).json({ section, cvMinuteSection });
        return;
      }
    }

    // update (cvMinuteSection &| sectionInfo)
    if (body.updateCvMinuteSection) {
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });

      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      } else {
        if (
          !isEmpty(body.sectionTitle) &&
          body.sectionTitle.trim() !== cvMinuteSection.sectionTitle
        ) {
          cvMinuteSection = await prisma.cvMinuteSection.update({
            where: { id: cvMinuteSection.id },
            data: { sectionTitle: body.sectionTitle.trim() },
          });
        }

        // (update | create) sectionInfo
        if (body.sectionInfoId) {
          sectionInfo = await prisma.sectionInfo.findUnique({
            where: { id: body.sectionInfoId },
          });

          if (body.content !== sectionInfo.content) {
            sectionInfo = await prisma.sectionInfo.update({
              where: { id: body.sectionInfoId },
              data: { content: body.content.trim() || ' ' },
            });
          }
        } else {
          sectionInfo = await prisma.sectionInfo.create({
            data: {
              cvMinuteSectionId: cvMinuteSection.id,
              content: body.content.trim() || ' ',
            },
          });
        }

        cvMinuteSection = await prisma.cvMinuteSection.findUnique({
          where: { id: cvMinuteSection.id },
          include: { sectionInfos: true },
        });

        res.status(200).json({ cvMinuteSection });
        return;
      }
    }

    // (create | update) experience
    if (body.updateExperience) {
      cvMinuteSection = await prisma.cvMinuteSection.findUnique({
        where: { id: body.cvMinuteSectionId },
      });
      if (!cvMinuteSection) {
        res.json({ cvMinuteSectionNotFound: true });
        return;
      }

      const infosToUpdate = {
        title: body.title.trim(),
        order: body.sectionInfoOrder,
        content: body.content.trim(),
        company: body.company.trim(),
        date: body.date.trim(),
        contrat: body.contrat.trim(),
      };

      if (body.sectionInfoId) {
        sectionInfo = await prisma.section.update({
          where: { id: body.sectionInfoId },
          data: infosToUpdate,
        });

        if (!sectionInfo) {
          res.json({ sectionInfoNotFound: true });
          return;
        }
      } else {
        sectionInfo = await prisma.sectionInfo.create({
          data: {
            ...infosToUpdate,
            cvMinuteSectionId: cvMinuteSection.id,
          },
        });
      }
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
  updateCvMinuteSection,
  updateSectionsOrder,
};
