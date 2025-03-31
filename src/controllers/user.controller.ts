import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import isEmpty from '../utils/isEmpty';

const prisma = new PrismaClient();

const get = async (req: Request, res: Response): Promise<void> => {
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

    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      user: { ...userWithoutPassword, image: profile?.name || null },
    });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const update = async (req: Request, res: Response): Promise<void> => {
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
        fileName = `${res.locals.user.id}${extension}`;
        const directoryPath = path.join(
          __dirname,
          `../uploads/files/${res.locals.user.id}`,
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

export { get, update };
