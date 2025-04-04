import express from 'express';
import multer from 'multer';

import {
  acceptConditions,
  cvMinute,
  getUser,
  updateUser,
} from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  cvMinuteValidation,
  updateProfileValidation,
} from '../validations/user.validation';

const upload = multer();
const router = express.Router();

router.get('/', isAuthenticated, getUser);
router.get('/accept-conditions', isAuthenticated, acceptConditions);

router.post(
  '/cv-minute',
  upload.single('file'),
  isAuthenticated,
  cvMinuteValidation,
  cvMinute,
);

router.put(
  '/update-profile',
  upload.single('file'),
  isAuthenticated,
  updateProfileValidation,
  updateUser,
);

export default router;
