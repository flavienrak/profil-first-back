import jwt from 'jsonwebtoken';
import prisma from '@/lib/db';

import { Request, Response, NextFunction } from 'express';
import { authTokenName, jwtSecretKey } from '@/utils/env';

const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[authTokenName];
    if (token) {
      const verify = jwt.verify(token, jwtSecretKey);
      if ((verify as jwt.JwtPayload)?.infos) {
        const userId = (verify as jwt.JwtPayload).infos.id;
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { userInfos: true },
        });

        if (user) {
          if (!user.userInfos?.verified) {
            res.json({ notVerified: true });
            res.clearCookie(authTokenName);
            return;
          } else {
            res.locals.user = user;
            next();
          }
        } else {
          res.clearCookie(authTokenName);
          res.json({ unAuthorized: true });
          return;
        }
      } else {
        res.locals.user = null;
        res.clearCookie(authTokenName);
        res.json({ unAuthorized: true });
        return;
      }
    } else {
      res.json({ noToken: true });
      return;
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: true });
    }
    return;
  }
};

export { isAuthenticated };
