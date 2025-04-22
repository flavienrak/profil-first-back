import { body, param } from 'express-validator';

const respondQualiCarriereQuestionValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  body().custom((value, { req }) => {
    if (!req.file && !req.body?.content) {
      throw new Error('Data required');
    }

    if (
      !req.body?.content &&
      req.file &&
      !req.file.mimetype.startsWith('audio/')
    ) {
      throw new Error('Invalid file');
    }

    return true;
  }),
];

const senndQualiCarriereMessageValidation = [
  body('message').trim().notEmpty().withMessage('message required'),
];

export {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
};
