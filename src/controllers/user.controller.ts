import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '@/lib/db';
import isEmpty from '@/utils/isEmpty';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { imageMimeTypes } from '@/utils/constants';
import { UserInterface } from '@/interfaces/user.interface';

const uniqueId = crypto.randomBytes(4).toString('hex');

const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals as { user: UserInterface };
    let cvMinuteCount = 0;

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        files: true,
        userInfos: true,
        payments: { include: { credit: true } },
      },
    });

    if (!userData) {
      res.json({ userNotFound: true });
      return;
    }

    if (userData.role === 'candidat') {
      cvMinuteCount = await prisma.cvMinute.count({
        where: {
          userId: userData.id,
          qualiCarriereRef: false,
          generated: null,
        },
      });
    }

    const { password, ...userWithoutPassword } = userData;

    res.status(200).json({
      user: { ...userWithoutPassword },
      cvMinuteCount,
    });
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

const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals as { user: UserInterface };

    let fileName = '';
    const body: { name?: string; password?: string } = req.body;
    const infos: { name?: string; password?: string } = {};

    if (body.name) {
      infos.name = body.name;
    }

    if (body.password) {
      const incorrectPassword = await bcrypt.compare(
        body.password,
        user.password,
      );

      if (!incorrectPassword) {
        res.json({ incorrectPassword: true });
        return;
      }
      const salt = await bcrypt.genSalt();
      const newPassword = await bcrypt.hash(body.password, salt);
      infos.password = newPassword;
    }

    if (req.file) {
      if (imageMimeTypes.includes(req.file.mimetype)) {
        const extension = path.extname(req.file.originalname);
        fileName = `profile-${user.id}-${Date.now()}-${uniqueId}${extension}`;
        const uploadsBase = path.join(process.cwd(), 'uploads');
        const directoryPath = path.join(uploadsBase, `/files/user-${user.id}`);
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
            usage: 'profile',
            userId: user.id,
          },
        });
      }
    }

    if (isEmpty(infos)) {
      res.json({ noChanges: true });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: infos,
    });

    const { password, ...userWithoutPassword } = updatedUser;

    res.status(200).json({ user: { ...userWithoutPassword, image: fileName } });
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

const updateUserInfos = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals as { user: UserInterface };

    const body: {
      acceptConditions?: boolean;
      acceptFreeUse?: boolean;
      mode?: string;
      fontSize?: number;
    } = req.body;

    const infos: {
      acceptConditions?: boolean;
      acceptFreeUse?: boolean;
      mode?: string;
      fontSize?: number;
    } = {};

    if (body.acceptConditions) {
      infos.acceptConditions = body.acceptConditions;
    }
    if (body.acceptFreeUse) {
      infos.acceptFreeUse = body.acceptFreeUse;
    }
    if (body.mode) {
      infos.mode = body.mode;
    }
    if (body.fontSize) {
      infos.fontSize = body.fontSize;
    }

    if (isEmpty(infos)) {
      res.json({ noChanges: true });
      return;
    }

    const userInfos = await prisma.userInfos.update({
      where: { id: user.id },
      data: infos,
    });

    res.status(200).json({ userInfos });
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

export { getUser, updateUser, updateUserInfos };
