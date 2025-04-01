import { body } from 'express-validator';

const loginValidations = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('email required')
    .isEmail()
    .withMessage('invalid email'),
  body('password')
    .notEmpty()
    .withMessage('password required')
    .isLength({ min: 6 })
    .withMessage('invalid password'),
];

const registerValidations = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name required')
    .isLength({ min: 3 })
    .withMessage('invalid name'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('email required')
    .isEmail()
    .withMessage('invalid email'),
  body('password')
    .notEmpty()
    .withMessage('password required')
    .isLength({ min: 6 })
    .withMessage('invalid password'),
  body('role')
    .trim()
    .notEmpty()
    .withMessage('role required')
    .isIn(['user', 'recruiter'])
    .withMessage('invalid role'),
];

export { loginValidations, registerValidations };
