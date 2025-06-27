import { body, param } from 'express-validator';

const stripeValidation = [
  body('type')
    .trim()
    .notEmpty()
    .isIn(['premium', 'booster', 'quali-carriere'])
    .withMessage('type required'),
];

const stripeSessionValidation = [
  param('sessionId').trim().notEmpty().withMessage('SessionId required'),
];

export { stripeValidation, stripeSessionValidation };
