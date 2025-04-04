import express from 'express';

import { login, logout, register } from '../controllers/auth.controller';
import {
  loginValidation,
  registerValidation,
} from '../validations/auth.validation';

const router = express.Router();

router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);
router.get('/logout', logout);

export default router;
