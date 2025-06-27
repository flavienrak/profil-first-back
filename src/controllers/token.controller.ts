import prisma from '@/lib/db';
import jwt from 'jsonwebtoken';

import { Request, Response } from 'express';
import {
  authTokenType,
  mailValidationType,
  maxAgeAuthToken,
} from '@/utils/constants';
import { authTokenName, jwtSecretKey } from '@/utils/env';
import { UserInterface } from '@/interfaces/user.interface';
import { sendVerificationEmail } from '@/utils/mailer';

const verifyMailToken = async (req: Request, res: Response) => {
  try {
    const { user, infos } = res.locals as {
      user: UserInterface;
      infos: { id: number; type: string; code?: string };
    };

    if (!infos.code) {
      res.json({ invalidToken: true });
      return;
    } else if (user.userInfos?.verified) {
      await prisma.token.deleteMany({
        where: { userId: user.id, type: mailValidationType },
      });

      res.json({ alreadyVerified: true });
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

const verifyMail = async (req: Request, res: Response) => {
  try {
    const { user, infos } = res.locals as {
      user: UserInterface;
      infos: { id: number; type: string; code?: string };
    };

    const { code } = req.body as { code: string };

    if (!infos.code) {
      res.json({ invalidToken: true });
      return;
    } else if (code !== infos.code) {
      res.json({ invalidCode: true });
      return;
    }

    await prisma.userInfos.update({
      where: { userId: infos.id },
      data: { verified: true },
    });

    await prisma.token.deleteMany({
      where: { userId: infos.id, type: mailValidationType },
    });

    const jwtInfos = {
      id: infos.id,
      type: authTokenType,
    };

    const authToken = jwt.sign({ infos: jwtInfos }, jwtSecretKey, {
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

    res.status(200).json({ user: { id: infos.id, role: user.role } });
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

const resendMailToken = async (req: Request, res: Response) => {
  try {
    const { user, infos } = res.locals as {
      user: UserInterface;
      infos: { id: number; type: string; code?: string };
    };

    if (!infos.code) {
      res.json({ invalidToken: true });
      return;
    }

    await sendVerificationEmail({
      name: user.name,
      email: user.email,
      code: infos.code,
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

export { verifyMailToken, verifyMail, resendMailToken };
