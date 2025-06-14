import express from 'express';

import {
  stripeController,
  stripeSessionController,
} from '@/controllers/payment.controller';
import {
  stripeSessionValidation,
  stripeValidation,
} from '@/validations/payment.validation';

const router = express.Router();

router.post('/stripe', stripeValidation, stripeController);
router.get(
  '/stripe/:sessionId',
  stripeSessionValidation,
  stripeSessionController,
);

export default router;
