import express from 'express';
import { login, logout, register } from '../controllers/auth.controller';
import {
  loginValidations,
  registerValidations,
} from '../validations/auth.validations';

const router = express.Router();

router.post('/login', loginValidations, login);
router.post('/register', registerValidations, register);
router.get('/logout', logout);

export default router;
