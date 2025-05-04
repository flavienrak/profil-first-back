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

const updateQualiCarriereResumeValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  body('content').trim().notEmpty().withMessage('content required'),
];

const updateQualiCarriereCompetenceValidation = [
  body('competences')
    .isArray({ min: 1 })
    .withMessage('competences must be a non-empty array'),

  body('competences.*.id')
    .notEmpty()
    .withMessage('id is required')
    .isInt()
    .withMessage('id must be an integer'),

  body('competences.*.content')
    .notEmpty()
    .withMessage('content is required')
    .isString()
    .withMessage('content must be a string')
    .trim(),
];

export {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
  updateQualiCarriereResumeValidation,
  updateQualiCarriereCompetenceValidation,
};
