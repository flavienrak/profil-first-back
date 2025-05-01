import express from 'express';

const checkUserRole = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const { user } = res.locals;

  if (user.role !== 'user') {
    res.json({ notPermitted: true });
    return;
  }

  next();
};

export { checkUserRole };
