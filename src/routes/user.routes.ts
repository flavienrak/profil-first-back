import express from 'express';
import multer from 'multer';

import { get, update } from '../controllers/user.controller.js';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { updateProfileValidations } from 'validations/user.validations.js';

const upload = multer();
const router = express.Router();

router.get('/get-user', isAuthenticated, get);

router.put(
  '/update-profile',
  upload.single('file'),
  isAuthenticated,
  updateProfileValidations,
  update,
);

export default router;
