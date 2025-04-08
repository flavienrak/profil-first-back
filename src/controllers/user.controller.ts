import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import isEmpty from '../utils/isEmpty';

import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';

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

    const user = await prisma.user.findUnique({
      where: { id: res.locals.user.id },
    });

    const profile = await prisma.file.findFirst({
      where: { userId: res.locals.user.id, usage: 'profile' },
      select: { name: true },
      orderBy: { updatedAt: 'desc' },
    });

    const cvMinuteCount = await prisma.cvMinute.count({
      where: { userId: res.locals.user.id },
    });

    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      user: { ...userWithoutPassword, image: profile?.name || null },
      cvMinuteCount,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const updateUser = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let user = null;
    let fileName = null;
    const body = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const infos: { name?: string; password?: string } = {};

    if (body.name) {
      infos.name = body.name;
    }

    if (body.password) {
      const incorrectPassword = await bcrypt.compare(
        body.password,
        res.locals.user.password,
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
      if (req.file.mimetype.startsWith('image/')) {
        const extension = path.extname(req.file.originalname);
        fileName = `profile-${res.locals.user.id}-${Date.now()}-${uniqueId}${extension}`;
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
            usage: 'profile',
            userId: res.locals.user.id,
          },
        });
      }
    }

    if (isEmpty(infos)) {
      res.json({ noChanges: true });
      return;
    }

    user = await prisma.user.update({
      where: { id: res.locals.user.id },
      data: infos,
    });

    const { password, ...userWithoutPassword } = user;

    res.status(200).json({ user: { ...userWithoutPassword, image: fileName } });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const acceptConditions = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: res.locals.user.id },
      data: { acceptConditions: true },
    });

    res.status(200).json({ user: { acceptConditions: true } });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { getUser, updateUser, acceptConditions };
