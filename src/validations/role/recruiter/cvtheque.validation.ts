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

export {
  addCvThequeCritereValidation,
  updateCvThequeCritereValidation,
  resendCvThequeCritereValidation,
};
