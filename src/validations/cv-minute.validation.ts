import isEmpty from '../utils/isEmpty';
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

    return true;
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
    } else if (body.updateContactSection) {
      return (
        !isEmpty(body.cvMinuteSectionId) &&
        !isNaN(body.cvMinuteSectionId) &&
        !isEmpty(body.content) &&
        !isEmpty(body.sectionInfoOrder) &&
        !isNaN(body.sectionInfoOrder) &&
        !isEmpty(body.icon) &&
        !isEmpty(body.iconSize) &&
        !isNaN(Number(body.iconSize))
      );
    } else if (body.newSection) {
      return (
        !isEmpty(body.cvMinuteSectionId) &&
        !isNaN(body.cvMinuteSectionId) &&
        !isEmpty(body.content) &&
        !isEmpty(body.title)
      );
    } else if (body.updateExperience) {
      return (
        !isEmpty(body.cvMinuteSectionId) &&
        !isNaN(body.cvMinuteSectionId) &&
        !isEmpty(body.sectionInfoOrder) &&
        !isNaN(body.sectionInfoOrder) &&
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
  body('targetCvMinuteSectionId')
    .notEmpty()
    .withMessage('targetCvMinuteSectionId required')
    .isInt()
    .withMessage('invalid targetCvMinuteSectionId'),
];

const updateSectionInfoOrderValidation = [
  body('sectionInfoId')
    .notEmpty()
    .withMessage('sectionInfoId required')
    .isInt()
    .withMessage('invalid sectionInfoId'),
  body('targetSectionInfoId')
    .notEmpty()
    .withMessage('targetSectionInfoId required')
    .isInt()
    .withMessage('invalid targetSectionInfoId'),
];

const sectionInfoIdValidation = [
  param('sectionInfoId')
    .notEmpty()
    .withMessage('sectionInfoId required')
    .isInt()
    .withMessage('invalid sectionInfoId'),
];

export {
  addCvMinuteValidation,
  updateCvMinuteProfileValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateSectionInfoOrderValidation,
  sectionInfoIdValidation,
};
