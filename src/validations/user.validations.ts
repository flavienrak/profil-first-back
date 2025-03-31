import { body } from 'express-validator';

const updateProfileValidations = [
  body('name').trim().optional(),
  body('password').optional(),
];

export { updateProfileValidations };
