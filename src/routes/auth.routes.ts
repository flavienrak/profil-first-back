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

// router.post(
//   '/',
//   async (req: express.Request, res: express.Response): Promise<void> => {
//     try {
//       const body: { receiver: string } = req.body;

//       res.status(200).json({ message });
//       return;
//     } catch (error) {
//       res.status(500).json({ error: `${error.message}` });
//       return;
//     }
//   },
// );

export default router;
