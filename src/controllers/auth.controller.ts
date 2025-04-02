import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { maxAgeAuthToken } from '../utils/constants';

dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY;
const authTokenName = process.env.AUTH_TOKEN_NAME;

const prisma = new PrismaClient();

const login = async (req: Request, res: Response): Promise<void> => {
  try {
    let user = null;
    const body = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user || (user && user.role !== body.role)) {
      res.json({ userNotFound: true });
      return;
    }

    const incorrectPassword = await bcrypt.compare(
      body.password,
      user.password,
    );

    if (!incorrectPassword) {
      res.json({ incorrectPassword: true });
      return;
    }

    const infos = {
      id: user.id,
      authToken: true,
    };

    const authToken = jwt.sign({ infos }, secretKey, {
      expiresIn: maxAgeAuthToken,
    });

    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: boolean | 'none' | 'lax' | 'strict';
      maxAge?: number;
    } = {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    };
    if (body.remember) {
      cookieOptions.maxAge = maxAgeAuthToken;
    }

    res.cookie(authTokenName, authToken, cookieOptions);

    res.status(200).json({ user: user.id });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const register = async (req: Request, res: Response): Promise<void> => {
  try {
    let user = null;
    const body = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user) {
      res.json({ userAlreadyExist: true });
      return;
    }

    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash(body.password, salt);

    user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        password,
        role: body.role,
      },
    });

    res.status(200).json({ user: user.id });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

const logout = async (req: Request, res: Response) => {
  res.cookie(authTokenName, '', { maxAge: -1 });
  res.redirect('/');
};

export { login, register, logout };
