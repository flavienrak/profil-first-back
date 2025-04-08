import { body } from 'express-validator';

const updateProfileValidation = [
  body('name').trim().optional(),
  body('password').optional(),
];

export { updateProfileValidation };
