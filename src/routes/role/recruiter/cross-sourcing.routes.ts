import express from 'express';

import {
  getUserCvMinute,
  getUserCvMinutes,
  getUsers,
} from '@/controllers/role/recruiter/cross-sourcing/cross-sourcing.controller';
import {
  getUserCvMinutesValidation,
  getUserCvMinuteValidation,
} from '@/validations/role/recruiter/cross-sourcing.validation';
import { checkCrossSourcingUser } from '@/middlewares/role/recruiter/cross-sourcing.middleware';

const router = express.Router();

router.get('/', getUsers);

router.get(
  '/:id',
  getUserCvMinutesValidation,
  checkCrossSourcingUser,
  getUserCvMinutes,
);

router.get(
  '/:id/cv-minute/:cvMinuteId',
  getUserCvMinuteValidation,
  checkCrossSourcingUser,
  getUserCvMinute,
);

export default router;
