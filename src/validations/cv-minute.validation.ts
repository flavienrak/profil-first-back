import { body, param } from 'express-validator';

const addSectionsValidation = [
  param('cvMinuteId')
    .notEmpty()
    .withMessage('cvMinuteId required')
    .isInt()
    .withMessage('invalid cvMinuteId'),
  body('sections')
    .isArray({ min: 1 })
    .withMessage('sections required')
    .custom((sections) => {
      const isValid = sections.every((item: any) => {
        return item.name && item.name.trim().length > 0;
      });
      if (!isValid) {
        throw new Error("sections'name required");
      }
      return true;
    }),
];

const udpateSectionTitleValidation = [
  param('cvMinuteId')
    .notEmpty()
    .withMessage('cvMinuteId required')
    .isInt()
    .withMessage('invalid cvMinuteId'),
  body('sectionId')
    .notEmpty()
    .withMessage('sectionId required')
    .isInt()
    .withMessage('invalid sectionId'),
  body('title').trim().notEmpty().withMessage('title required'),
];

const udpateSectionOrderValidation = [
  param('cvMinuteId')
    .notEmpty()
    .withMessage('cvMinuteId required')
    .isInt()
    .withMessage('invalid cvMinuteId'),
  body('sectionId')
    .notEmpty()
    .withMessage('sectionId required')
    .isInt()
    .withMessage('invalid sectionId'),
  body('order')
    .notEmpty()
    .withMessage('order required')
    .isInt()
    .withMessage('invalid order'),
];

const sectionRelationsValidation = [
  param('cvMinuteId')
    .notEmpty()
    .withMessage('cvMinuteId required')
    .isInt()
    .withMessage('invalid cvMinuteId'),
  body('name').trim().notEmpty().withMessage('name required'),
];

export {
  addSectionsValidation,
  udpateSectionTitleValidation,
  udpateSectionOrderValidation,
  sectionRelationsValidation,
};
