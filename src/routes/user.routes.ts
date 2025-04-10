import express from 'express';
import multer from 'multer';

import {
  acceptConditions,
  getUser,
  updateUser,
} from '../controllers/user.controller';
import { updateProfileValidation } from '../validations/user.validation';

const upload = multer();
const router = express.Router();

router.get('/', getUser);
router.get('/accept-conditions', acceptConditions);

router.put(
  '/update-profile',
  upload.single('file'),
  updateProfileValidation,
  updateUser,
);

export default router;
