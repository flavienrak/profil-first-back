import express from 'express';

import {
  getUser,
  updateUser,
  updateUserInfos,
} from '@/controllers/user.controller';
import {
  updateProfileValidation,
  updateUserInfosValidation,
} from '@/validations/user.validation';
import { upload } from '@/lib/multer';

const router = express.Router();

router.get('/', getUser);
router.put(
  '/update-profile',
  upload.single('file'),
  updateProfileValidation,
  updateUser,
);
router.put('/user-infos', updateUserInfosValidation, updateUserInfos);

export default router;
