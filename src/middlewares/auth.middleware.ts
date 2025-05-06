import express from 'express';
import jwt from 'jsonwebtoken';

import { PrismaClient } from '@prisma/client';

const authTokenName = process.env.AUTH_TOKEN_NAME;
const secretKey = process.env.JWT_SECRET_KEY;

const prisma = new PrismaClient();

const isAuthenticated = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    if (authTokenName && secretKey) {
      const token = req.cookies?.[authTokenName];
      if (token) {
        const verify = jwt.verify(token, secretKey);
        if ((verify as jwt.JwtPayload)?.infos) {
          const userId = (verify as jwt.JwtPayload).infos.id;
          const user = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (user) {
            res.locals.user = user;
            next();
          } else {
            res.locals.user = null;
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
        res.locals.user = null;
        res.json({ unAuthorized: true });
        return;
      }
    } else {
      res.json({ envNotFound: true });
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
