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
  cvMinuteValidations,
  updateProfileValidations,
} from '../validations/user.validations';

const upload = multer();
const router = express.Router();

router.get('/', isAuthenticated, getUser);
router.get('/accept-conditions', isAuthenticated, acceptConditions);

router.post(
  '/cv-minute',
  upload.single('file'),
  isAuthenticated,
  cvMinuteValidations,
  cvMinute,
);

router.put(
  '/update-profile',
  upload.single('file'),
  isAuthenticated,
  updateProfileValidations,
  updateUser,
);

export default router;
