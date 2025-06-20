import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db';

import { v4 as uuid4 } from 'uuid';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { maxAgeAuthToken } from '@/utils/constants';
import { getCredit } from '@/utils/payment/credit';
import { UserInterface } from '@/interfaces/user.interface';

const secretKey = process.env.JWT_SECRET_KEY;
const authTokenName = process.env.AUTH_TOKEN_NAME;

const requireAuth = (req: Request, res: Response): void => {
  const { user } = res.locals as { user: UserInterface };

  if (!user) {
    res.json({ notAuthenticated: true });
    return;
  }

  res.status(200).json({ user: { id: user.id, role: user.role } });
  return;
};

const login = async (req: Request, res: Response): Promise<void> => {
  if (authTokenName && secretKey) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const body: {
        email: string;
        password: string;
        role: string;
        remember: boolean;
      } = req.body;

      let user = await prisma.user.findUnique({
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
        role: user.role,
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
        sameSite: 'none',
      };
      if (body.remember) {
        cookieOptions.maxAge = maxAgeAuthToken;
      }

      res.cookie(authTokenName, authToken, cookieOptions);

      res.status(200).json({ user: { id: user.id, role: user.role } });
      return;
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ unknownError: error });
      }
      return;
    }
  }
};

const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const body: {
      name: string;
      email: string;
      password: string;
      role: string;
    } = req.body;

    let user = await prisma.user.findUnique({ where: { email: body.email } });
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

    if (user.role === 'candidat') {
      await prisma.userInfos.create({ data: { userId: user.id } });

      const sessionId = uuid4();
      const payment = await prisma.payment.create({
        data: {
          amount: 0,
          name: 'Free Access',
          type: 'free',
          currency: 'eur',
          sessionId,
          status: 'paid',
          userId: user.id,
        },
      });

      const creditValue = getCredit('free');
      await prisma.credit.create({
        data: { value: creditValue, paymentId: payment.id, userId: user.id },
      });
    }

    res.status(201).json({ userId: user.id });
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

const logout = async (req: Request, res: Response) => {
  if (authTokenName) {
    res.clearCookie(authTokenName, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.status(200).json({ loggedOut: true });
    return;
  }
};

export { requireAuth, login, register, logout };
