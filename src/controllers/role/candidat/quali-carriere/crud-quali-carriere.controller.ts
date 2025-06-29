import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserInterface } from '@/interfaces/user.interface';

const changeQualiCarriereStatus = async (req: Request, res: Response) => {
  try {
    let updatedUser: UserInterface | null = null;
    const { user } = res.locals as { user: UserInterface };

    if (user.qualiCarriere === '' || user.qualiCarriere === 'inactive') {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { qualiCarriere: 'active' },
      });
    } else if (user.qualiCarriere === 'active') {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { qualiCarriere: 'inactive' },
      });
    }

    res
      .status(200)
      .json({ user: { qualiCarriere: updatedUser?.qualiCarriere } });
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

const editQualiCarriereResume = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const body = req.body as { content: string };

    const qualiCarrirereResume = await prisma.qualiCarriereResume.update({
      where: { id: Number(id) },
      data: { content: body.content },
    });

    res.status(200).json({ qualiCarrirereResume });
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

const editQualiCarriereCompetence = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const body = req.body as { competences: { id: number; content: string }[] };

    const qualiCarriereCompetences = await Promise.all(
      body.competences.map((c) =>
        prisma.qualiCarriereCompetence.update({
          where: { id: c.id },
          data: { content: c.content },
        }),
      ),
    );

    res.status(200).json({ qualiCarriereCompetences });
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
  changeQualiCarriereStatus,
  editQualiCarriereResume,
  editQualiCarriereCompetence,
};
