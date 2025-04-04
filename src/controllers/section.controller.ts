import express from 'express';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';

const prisma = new PrismaClient();

const addSections = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const sections = [];
    const cvMinuteSections = [];
    const body = req.body;
    const { cvMinuteId } = req.params;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvMinuteId) },
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
            sectionTitle: s.title,
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

const updateSectionTitle = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { cvMinuteId } = req.params;
    const body = req.body;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvMinuteId) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const section = await prisma.section.findUnique({
      where: { id: body.sectionId },
    });
    if (!section) {
      res.json({ sectionNotFound: true });
      return;
    } else if (!section.editable) {
      res.json({ notEditable: true });
      return;
    }

    const cvMinuteSection = await prisma.cvMinuteSection.update({
      where: {
        cvMinuteId_sectionId: {
          cvMinuteId: cvMinute.id,
          sectionId: body.sectionId,
        },
      },
      data: { sectionTitle: body.title.trim() },
    });

    res.status(200).json({ cvMinuteSection });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateSectionOrder = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const cvMinuteSections = [];
    const { cvMinuteId } = req.params;
    const body = req.body;

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvMinuteId) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    const section = await prisma.section.findUnique({
      where: { id: body.sectionId },
    });
    if (!section) {
      res.json({ sectionNotFound: true });
      return;
    } else if (!section.editable) {
      res.json({ notEditable: true });
      return;
    }

    for (const s of body.sections) {
      const cvMinuteSection = await prisma.cvMinuteSection.update({
        where: {
          cvMinuteId_sectionId: {
            cvMinuteId: cvMinute.id,
            sectionId: section.id,
          },
        },
        data: { sectionOrder: s.order },
      });

      cvMinuteSections.push(cvMinuteSection);
    }

    res.status(20).json({ cvMinuteSections });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const sectionRelations = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const { cvMinuteId } = req.params;
    const body = req.body;
    let relations = [];
    let sections = [];

    const cvMinute = await prisma.cvMinute.findUnique({
      where: { id: Number(cvMinuteId) },
    });
    if (!cvMinute) {
      res.json({ cvMinuteNotFound: true });
      return;
    }

    for (const s of body.sections) {
      let section = await prisma.section.findUnique({
        where: { name: s.name.trim().toLowerCase() },
      });

      if (!section) {
        section = await prisma.section.create({
          data: {
            name: s.name.trim().toLowerCase(),
            editable: s.editable,
          },
        });
      }

      const cvMinuteSection = await prisma.cvMinuteSection.create({
        data: {
          cvMinuteId: cvMinute.id,
          sectionId: section.id,
          sectionTitle: s.title.trim(),
          sectionOrder: s.order,
        },
      });

      relations.push(cvMinuteSection);
      sections.push(section);
    }

    res.status(201).json({ sections, relations });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export {
  addSections,
  updateSectionTitle,
  updateSectionOrder,
  sectionRelations,
};
