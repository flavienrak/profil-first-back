import { body, param } from 'express-validator';

const getCvMinuteValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
];

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

const addSectionsValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
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

const udpateSectionValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  body('sectionId')
    .notEmpty()
    .withMessage('sectionId required')
    .isInt()
    .withMessage('invalid sectionId'),
];

const udpateSectionsOrderValidation = [
  param('id')
    .notEmpty()
    .withMessage('id required')
    .isInt()
    .withMessage('invalid id'),
  body('sections')
    .isArray({ min: 1 })
    .withMessage('sections required')
    .custom((sections) => {
      const isValid = sections.every((item: any) => {
        return item.id && Number(item.id) && item.order && Number(item.order);
      });
      if (!isValid) {
        throw new Error("sections'infos invalid");
      }
      return true;
    }),
];

export {
  getCvMinuteValidation,
  addCvMinuteValidation,
  addSectionsValidation,
  udpateSectionValidation,
  udpateSectionsOrderValidation,
};
