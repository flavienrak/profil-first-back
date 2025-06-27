import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db';

import { v4 as uuid4 } from 'uuid';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  authTokenType,
  mailValidationType,
  maxAgeAuthToken,
  resetPasswordTokenType,
} from '@/utils/constants';
import { getCredit } from '@/utils/payment/credit';
import { UserInterface } from '@/interfaces/user.interface';
import { sendResetPasswordEmail, sendVerificationEmail } from '@/utils/mailer';
import { generateSecureCode } from '@/utils/functions';
import { authTokenName, frontendUri, jwtSecretKey } from '@/utils/env';

const requireAuth = (req: Request, res: Response): void => {
  const { user } = res.locals as { user: UserInterface };

  if (!user) {
    res.json({ notAuthenticated: true });
    return;
  }

  res.status(200).json({ user: { id: user.id, role: user.role } });
  return;
};

const login = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const body = req.body as {
      email: string;
      password: string;
      role: string;
      remember: boolean;
    };

    let user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { userInfos: true, tokens: true },
    });
    if (
      !user
      // || (user && user.role !== body.role)
    ) {
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

    if (!user.userInfos?.verified) {
      const token = await prisma.token.findFirst({
        where: { userId: user.id, type: mailValidationType },
      });

      if (token && token.expiredAt > new Date()) {
        res.json({ notVerified: true, token: token.value });
        return;
      }

      const code = generateSecureCode();

      await sendVerificationEmail({
        name: user.name,
        email: user.email,
        code,
      });

      const infos = {
        id: user.id,
        code,
        type: mailValidationType,
      };
      const jwtToken = jwt.sign({ infos }, jwtSecretKey, {
        expiresIn: 15 * 60 * 1000,
      });

      await prisma.token.deleteMany({
        where: { userId: user.id, type: mailValidationType },
      });

      await prisma.token.create({
        data: {
          userId: user.id,
          type: mailValidationType,
          value: jwtToken,
          expiredAt: new Date(new Date().getTime() + 15 * 60 * 1000),
        },
      });

      res.json({ notVerified: true, token: jwtToken });
      return;
    }

    const infos = {
      id: user.id,
      type: authTokenType,
    };

    const authToken = jwt.sign({ infos }, jwtSecretKey, {
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
};

const register = async (req: Request, res: Response) => {
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
          type: 'free',
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

    const code = generateSecureCode();

    await sendVerificationEmail({ name: user.name, email: user.email, code });

    const infos = { id: user.id, type: mailValidationType, code };
    const token = jwt.sign({ infos }, jwtSecretKey, {
      expiresIn: 15 * 60 * 1000,
    });

    await prisma.token.create({
      data: {
        userId: user.id,
        type: mailValidationType,
        value: token,
        expiredAt: new Date(new Date().getTime() + 15 * 60 * 1000),
      },
    });

    res.status(201).json({ token });
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
  res.clearCookie(authTokenName, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });

  res.status(200).json({ loggedOut: true });
  return;
};

const verifyResetPasswordToken = async (req: Request, res: Response) => {
  try {
    const { infos } = res.locals as {
      infos: { id: number; type: string };
    };

    if (infos.type !== resetPasswordTokenType) {
      res.json({ invalidToken: true });
      return;
    }

    res.status(200).json({ valid: true });
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

const resetPasswordMail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email: string };

    const user = await prisma.user.findUnique({
      where: { email },
      include: { userInfos: true },
    });

    if (!user) {
      res.json({ userNotFound: true });
      return;
    }

    if (!user.userInfos?.verified) {
      const token = await prisma.token.findFirst({
        where: { userId: user.id, type: mailValidationType },
      });

      if (token && token.expiredAt > new Date()) {
        res.json({ notVerified: true, token: token.value });
        return;
      }

      const code = generateSecureCode();

      await sendVerificationEmail({
        name: user.name,
        email: user.email,
        code,
      });

      const infos = {
        id: user.id,
        code,
        type: mailValidationType,
      };
      const jwtToken = jwt.sign({ infos }, jwtSecretKey, {
        expiresIn: 15 * 60 * 1000,
      });

      await prisma.token.deleteMany({
        where: { userId: user.id, type: mailValidationType },
      });

      await prisma.token.create({
        data: {
          userId: user.id,
          type: mailValidationType,
          value: jwtToken,
          expiredAt: new Date(new Date().getTime() + 15 * 60 * 1000),
        },
      });

      res.json({ notVerified: true, token: jwtToken });
      return;
    }

    const infos = {
      id: user.id,
      type: resetPasswordTokenType,
    };
    const jwtToken = jwt.sign({ infos }, jwtSecretKey, {
      expiresIn: 15 * 60 * 1000,
    });

    const link = `${frontendUri}/auth/reset-password/${jwtToken}`;

    await prisma.token.deleteMany({
      where: { userId: user.id, type: resetPasswordTokenType },
    });

    await prisma.token.create({
      data: {
        userId: user.id,
        type: resetPasswordTokenType,
        value: jwtToken,
        expiredAt: new Date(new Date().getTime() + 15 * 60 * 1000),
      },
    });

    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      link,
    });

    res.status(200).json({ sent: true });
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

const resetPassword = async (req: Request, res: Response) => {
  try {
    const { user } = res.locals as {
      user: UserInterface;
    };

    const { password } = req.body as { password: string };

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await prisma.token.deleteMany({
      where: { userId: user.id, type: resetPasswordTokenType },
    });

    const infos = {
      id: user.id,
      role: user.role,
      type: authTokenType,
    };

    const authToken = jwt.sign({ infos }, jwtSecretKey, {
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
};

export {
  requireAuth,
  login,
  register,
  logout,
  resetPasswordMail,
  verifyResetPasswordToken,
  resetPassword,
};
