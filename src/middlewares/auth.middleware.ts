import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import dotenv from 'dotenv';
import isEmpty from '../utils/isEmpty';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const authTokenName = process.env.AUTH_TOKEN_NAME;
const secretKey = process.env.JWT_SECRET_KEY;

const prisma = new PrismaClient();

const checkUser = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[authTokenName];
  if (token) {
    const verify = jwt.verify(token, secretKey);
    if ((verify as JwtPayload)?.infos) {
      const userId = (verify as JwtPayload).infos.id;
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      res.locals.user = user;
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

const requireAuth = (req: Request, res: Response): void => {
  if (!isEmpty(res.locals.user)) {
    const token = req.cookies?.[authTokenName];
    if (!isEmpty(token)) {
      const verify = jwt.verify(token, secretKey);
      if ((verify as JwtPayload)?.infos) {
        const userId = (verify as JwtPayload).infos.id;
        res.status(200).json({ userId });
        return;
      }
    }
  }
  res.json({ notAuthenticated: true });
  return;
};

const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.locals.user) {
    next();
  } else {
    res.status(403).json({ unAuthorized: true });
    return;
  }
};

export { checkUser, requireAuth, isAuthenticated };
