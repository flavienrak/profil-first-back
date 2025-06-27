import jwt from 'jsonwebtoken';
import prisma from '@/lib/db';

import { Request, Response, NextFunction } from 'express';
import { jwtSecretKey } from '@/utils/env';

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const verify = jwt.verify(token, jwtSecretKey);

    if (typeof verify === 'object' && verify !== null) {
      const user = await prisma.user.findUnique({
        where: { id: verify.infos.id },
        include: { userInfos: true },
      });

      if (user) {
        const token = await prisma.token.findFirst({
          where: { userId: verify.infos.id, type: verify.infos.type },
        });

        if (!token || token.type !== verify.infos.type) {
          res.json({ invalidToken: true });
          return;
        } else {
          res.locals.user = user;
          res.locals.token = token;
          res.locals.infos = verify.infos;
          next();
        }
      } else {
        res.json({ userNotFound: true });
        return;
      }
    } else {
      res.json({ invalidToken: true });
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

export { verifyToken };
