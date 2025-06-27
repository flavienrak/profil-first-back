import { Router } from 'express';
import {
  getUser,
  reservationContact,
  updateUser,
  updateUserInfos,
} from '@/controllers/user.controller';
import {
  reservationContactValidation,
  updateProfileValidation,
  updateUserInfosValidation,
} from '@/validations/user.validation';
import { upload } from '@/lib/multer';

const router = Router();

router.get('/', getUser);
router.put(
  '/update-profile',
  upload.single('file'),
  updateProfileValidation,
  updateUser,
);
router.put('/user-infos', updateUserInfosValidation, updateUserInfos);

router.post(
  '/reservation-contact',
  reservationContactValidation,
  reservationContact,
);

export default router;
