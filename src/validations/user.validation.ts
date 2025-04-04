import { body } from 'express-validator';

const updateProfileValidation = [
  body('name').trim().optional(),
  body('password').optional(),
];

const cvMinuteValidation = [
  body('position')
    .trim()
    .notEmpty()
    .isLength({ min: 5 })
    .withMessage('Position required'),
  body().custom((value, { req }) => {
    if (!req.file) {
      throw new Error('File required');
    }

    return true;
  }),
];

export { updateProfileValidation, cvMinuteValidation };
