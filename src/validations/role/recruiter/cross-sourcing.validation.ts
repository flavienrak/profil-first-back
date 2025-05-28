import { body, param } from 'express-validator';

const getUserCvMinutesValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
];

const getUserCvMinuteValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  param('cvMinuteId')
    .notEmpty()
    .withMessage('cvMinuteId required')
    .isInt()
    .withMessage('invalid cvMinuteId'),
];

export { getUserCvMinutesValidation, getUserCvMinuteValidation };
