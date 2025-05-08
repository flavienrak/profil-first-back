import { body, param } from 'express-validator';

const addCvThequeCritereValidation = [
  body('position').trim().notEmpty().withMessage('position required'),
  body('domain').trim().notEmpty().withMessage('domain required'),
  body().custom((value, { req }) => {
    const body = req.body;

    if (body.experience) {
      return !isNaN(body.experience);
    }

    if (body.distance) {
      return !isNaN(body.distance);
    }

    return true;
  }),
];

const updateCvThequeCritereValidation = [
  body().custom((value, { req }) => {
    const body = req.body;

    if (body.experience) {
      return !isNaN(body.experience);
    }

    if (body.distance) {
      return !isNaN(body.distance);
    }

    return Object.keys(body).length > 0;
  }),
];

const resendCvThequeCritereValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
];

const contactCvAnonymValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  param('cvAnonymId')
    .notEmpty()
    .withMessage('cvAnonymId required')
    .isInt()
    .withMessage('invalid cvAnonymId'),
  body('type').trim().notEmpty().withMessage('type required'),
  body('date').trim().notEmpty().withMessage('date required'),
  body('hour')
    .notEmpty()
    .withMessage('hour required')
    .isInt()
    .withMessage('invalid hour'),
  body('minute')
    .notEmpty()
    .withMessage('minute required')
    .isInt()
    .withMessage('invalid minute'),
  body('message').notEmpty().withMessage('message required'),
];

export {
  addCvThequeCritereValidation,
  updateCvThequeCritereValidation,
  resendCvThequeCritereValidation,
  contactCvAnonymValidation,
};
