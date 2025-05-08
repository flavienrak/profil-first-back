import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import isEmpty from '@/utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { imageMimeTypes } from '@/utils/constants';

const prisma = new PrismaClient();
const uniqueId = crypto.randomBytes(4).toString('hex');

const getUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
    let cvMinuteCount = 0;

    const profile = await prisma.file.findFirst({
      where: { userId: user.id, usage: 'profile' },
      select: { name: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (user.role === 'user') {
      cvMinuteCount = await prisma.cvMinute.count({
        where: { userId: user.id, qualiCarriereRef: false },
      });
    }

    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      user: { ...userWithoutPassword, image: profile?.name || null },
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

const updateUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;

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

export { getUser, updateUser };
