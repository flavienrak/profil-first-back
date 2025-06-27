import { Router } from 'express';
import {
  login,
  logout,
  register,
  requireAuth,
  resetPassword,
  resetPasswordMail,
  verifyResetPasswordToken,
} from '@/controllers/auth.controller';
import {
  loginValidation,
  registerValidation,
  resetPasswordMailValidation,
  resetPasswordValidation,
} from '@/validations/auth.validation';
import { isAuthenticated } from '@/middlewares/auth.middleware';
import { verifyToken } from '@/middlewares/token.middleware';

const router = Router();

router.get('/jwt', isAuthenticated, requireAuth);

router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);
router.get('/logout', logout);

router.get('/reset-password/:token', verifyToken, verifyResetPasswordToken);
router.post(
  '/reset-password/mail',
  resetPasswordMailValidation,
  resetPasswordMail,
);

router.post(
  '/reset-password/:token',
  verifyToken,
  resetPasswordValidation,
  resetPassword,
);

export default router;
