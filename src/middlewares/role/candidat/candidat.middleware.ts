import { Request, Response, NextFunction } from 'express';

const checkUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = res.locals;

  if (user.role !== 'candidat') {
    res.json({ notPermitted: true });
    return;
  }

  next();
};

export { checkUserRole };
