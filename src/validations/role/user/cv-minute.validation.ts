import isEmpty from '@/utils/isEmpty';
import { body, param } from 'express-validator';

const addCvMinuteValidation = [
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

const updateCvMinuteNameValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  body('name').trim().notEmpty().withMessage('name required'),
];

const updateCvMinuteVisibilityValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
];

const updateCvMinuteProfileValidation = [
  body('cvMinuteSectionId')
    .notEmpty()
    .withMessage('cvMinuteSectionId required')
    .isInt()
    .withMessage('invalid cvMinuteSectionId'),
  body().custom((value, { req }) => {
    if (!req.file) {
      throw new Error('File required');
    }

    return !isNaN(Number(req.body.cvMinuteSectionId));
  }),
];

const updateCvMinuteSectionValidation = [
  body().custom((value, { req }) => {
    const body = req.body;

    if (body.updateBg) {
      return (
        !isEmpty(body.primaryBg) &&
        !isEmpty(body.secondaryBg) &&
        !isEmpty(body.tertiaryBg)
      );
    } else if (
      body.updateName ||
      body.updateFirstName ||
      body.updatePresentation
    ) {
      return !isEmpty(body.content);
    } else if (body.updateTitle) {
      return body.content.length > 0;
    } else if (body.updateContact) {
      return (
        !isEmpty(body.cvMinuteSectionId) &&
        !isNaN(body.cvMinuteSectionId) &&
        !isEmpty(body.content) &&
        !isEmpty(body.icon) &&
        !isEmpty(body.iconSize) &&
        !isNaN(body.iconSize)
      );
    } else if (body.updateEditableSection) {
      return !isEmpty(body.name) && !isEmpty(body.content);
    } else if (body.newSection) {
      return !isEmpty(body.content) && !isEmpty(body.title);
    } else if (body.updateExperience) {
      return !isEmpty(body.cvMinuteSectionId) && !isNaN(body.cvMinuteSectionId);
    } else if (body.newExperience) {
      return (
        !isEmpty(body.title) &&
        !isEmpty(body.content) &&
        !isEmpty(body.company) &&
        !isEmpty(body.date) &&
        !isEmpty(body.contrat)
      );
    }
    return true;
  }),
];

const updateCvMinuteSectionOrderValidation = [
  body('cvMinuteSectionId')
    .notEmpty()
    .withMessage('cvMinuteSectionId required')
    .isInt()
    .withMessage('invalid cvMinuteSectionId'),
  body('dragIndex')
    .notEmpty()
    .withMessage('dragIndex required')
    .isInt()
    .withMessage('invalid dragIndex'),
  body('targetCvMinuteSectionId')
    .notEmpty()
    .withMessage('targetCvMinuteSectionId required')
    .isInt()
    .withMessage('invalid targetCvMinuteSectionId'),
  body('dropIndex')
    .notEmpty()
    .withMessage('dropIndex required')
    .isInt()
    .withMessage('invalid dropIndex'),
];

const cvMinuteSectionIdValidation = [
  param('cvMinuteSectionId')
    .notEmpty()
    .withMessage('cvMinuteSectionId required')
    .isInt()
    .withMessage('invalid cvMinuteSectionId'),
];

export {
  addCvMinuteValidation,
  updateCvMinuteNameValidation,
  updateCvMinuteVisibilityValidation,
  updateCvMinuteProfileValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  cvMinuteSectionIdValidation,
};
