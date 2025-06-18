import { Request, Response, NextFunction } from 'express';
import { UserInterface } from '@/interfaces/user.interface';

const checkIsRecruiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user } = res.locals as { user: UserInterface };

  if (user.role !== 'recruiter') {
    res.json({ notPermitted: true });
    return;
  }

  next();
};

export { checkIsRecruiter };
