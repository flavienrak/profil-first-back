import { body } from 'express-validator';

const mailValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('code required')
    .isLength({ min: 6 })
    .withMessage('invalid code'),
];

export { mailValidation };
