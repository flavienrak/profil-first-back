import express from 'express';
import multer from 'multer';

import {
  acceptConditions,
  getUser,
  updateUser,
} from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { updateProfileValidation } from '../validations/user.validation';

const upload = multer();
const router = express.Router();

router.get('/', isAuthenticated, getUser);
router.get('/accept-conditions', isAuthenticated, acceptConditions);

router.put(
  '/update-profile',
  upload.single('file'),
  isAuthenticated,
  updateProfileValidation,
  updateUser,
);

export default router;
