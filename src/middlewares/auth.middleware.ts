import express from 'express';
import jwt from 'jsonwebtoken';
import isEmpty from '../utils/isEmpty';

import { PrismaClient } from '@prisma/client';

const authTokenName = process.env.AUTH_TOKEN_NAME;
const secretKey = process.env.JWT_SECRET_KEY;

const prisma = new PrismaClient();

const checkUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const token = req.cookies?.[authTokenName];
  if (token) {
    const verify = jwt.verify(token, secretKey);
    if ((verify as jwt.JwtPayload)?.infos) {
      const userId = (verify as jwt.JwtPayload).infos.id;
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const { password, ...userWithoutPassword } = user;
      res.locals.user = userWithoutPassword;
      next();
    } else {
      res.locals.user = null;
      res.cookie(authTokenName, '', { maxAge: -1 });
      next();
    }
  } else {
    res.locals.user = null;
    next();
  }
};

const requireAuth = (req: express.Request, res: express.Response): void => {
  if (!isEmpty(res.locals.user)) {
    const token = req.cookies?.[authTokenName];
    if (!isEmpty(token)) {
      const verify = jwt.verify(token, secretKey);
      if ((verify as jwt.JwtPayload)?.infos) {
        const userId = (verify as jwt.JwtPayload).infos.id;
        res.status(200).json({ userId });
        return;
      }
    }
  }
  res.json({ notAuthenticated: true });
  return;
};

const isAuthenticated = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void => {
  if (res.locals.user) {
    next();
  } else {
    res.status(403).json({ unAuthorized: true });
    return;
  }
};

export { checkUser, requireAuth, isAuthenticated };
