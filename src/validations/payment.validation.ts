import { body, param } from 'express-validator';

const stripeValidation = [
  body('amount')
    .notEmpty()
    .withMessage('Amount required')
    .isInt({ gt: 0 })
    .withMessage('Invalid amount'),
  body('name').trim().notEmpty().withMessage('name required'),
  body('type').trim().notEmpty().withMessage('type required'),
];

const stripeSessionValidation = [
  param('sessionId').trim().notEmpty().withMessage('SessionId required'),
];

export { stripeValidation, stripeSessionValidation };
