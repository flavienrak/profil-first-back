import { Router } from 'express';
import {
  stripeController,
  stripeSessionController,
} from '@/controllers/payment.controller';
import {
  stripeSessionValidation,
  stripeValidation,
} from '@/validations/payment.validation';

const router = Router();

router.post('/stripe', stripeValidation, stripeController);
router.get(
  '/stripe/:sessionId',
  stripeSessionValidation,
  stripeSessionController,
);

export default router;
