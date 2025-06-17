import { body } from 'express-validator';

const updateProfileValidation = [
  body('name').trim().optional(),
  body('password').optional(),
];

const updateUserInfosValidation = [
  body().custom((value, { req }) => {
    const body = req.body;

    if (body.mode) {
      return (
        body.mode.trim() === 'system' ||
        body.mode.trim() === 'light' ||
        body.mode.trim() === 'dark'
      );
    } else if (body.acceptConditions) {
      return typeof body.acceptConditions === 'boolean';
    } else if (body.acceptFreeUse) {
      return typeof body.acceptFreeUse === 'boolean';
    } else if (body.fontSize) {
      return !isNaN(Number(body.fontSize));
    }

    return false;
  }),
];

export { updateProfileValidation, updateUserInfosValidation };
