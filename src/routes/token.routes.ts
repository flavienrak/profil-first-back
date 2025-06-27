import { Router } from 'express';
import {
  resendMailToken,
  verifyMail,
  verifyMailToken,
} from '@/controllers/token.controller';
import { verifyToken } from '@/middlewares/token.middleware';
import { mailValidation } from '@/validations/token.validation';

const router = Router();

router.get('/mail-validation/:token', verifyToken, verifyMailToken);
router.post('/mail-validation/:token', verifyToken, mailValidation, verifyMail);

router.get('/mail-validation/:token/resend', verifyToken, resendMailToken);

export default router;
