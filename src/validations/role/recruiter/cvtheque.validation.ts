import { body } from 'express-validator';

const addCvCritereValidation = [
  body('position').trim().notEmpty().withMessage('position required'),
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

export { addCvCritereValidation };
