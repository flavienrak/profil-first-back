import express from 'express';

import {
  login,
  logout,
  register,
  requireAuth,
} from '../controllers/auth.controller';
import {
  loginValidation,
  registerValidation,
} from '../validations/auth.validation';

const router = express.Router();

router.get('/jwt', requireAuth);

router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);
router.get('/logout', logout);

export default router;
