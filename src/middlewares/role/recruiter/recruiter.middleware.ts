import { Request, Response, NextFunction } from 'express';

const checkIsRecruiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = res.locals;

  if (user.role !== 'recruiter') {
    res.json({ notPermitted: true });
    return;
  }

  next();
};

export { checkIsRecruiter };
