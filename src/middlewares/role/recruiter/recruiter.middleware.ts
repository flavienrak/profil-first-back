import express from 'express';

const checkIsRecruiter = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const { user } = res.locals;

  if (user.role !== 'recruiter') {
    res.json({ notPermitted: true });
    return;
  }

  next();
};

export { checkIsRecruiter };
