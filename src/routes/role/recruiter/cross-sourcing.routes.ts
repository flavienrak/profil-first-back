import { Router } from 'express';
import {
  getUserCvMinute,
  getUserCvMinutes,
  getUsers,
} from '@/controllers/role/recruiter/cross-sourcing/cross-sourcing.controller';
import {
  getUserCvMinutesValidation,
  getUserCvMinuteValidation,
  getUsersValidation,
} from '@/validations/role/recruiter/cross-sourcing.validation';
import { checkCrossSourcingUser } from '@/middlewares/role/recruiter/cross-sourcing.middleware';

const router = Router();

router.get('/:domainId', getUsersValidation, getUsers);

router.get(
  '/:id/cv-minute',
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
