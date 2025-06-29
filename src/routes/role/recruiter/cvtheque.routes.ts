import { Router } from 'express';
import {
  addCvThequeCritere,
  saveCvThequeCritere,
  getCvThequeHistory,
  getCvAnonym,
  contactCvAnonym,
} from '@/controllers/role/recruiter/cvtheque/crud-cvtheque.controller';
import { getCvThequeCritere } from '@/controllers/role/recruiter/cvtheque/get-critere.controller';
import { updateCvThequeCritere } from '@/controllers/role/recruiter/cvtheque/update-critere.controller';
import { checkCvCritereOwner } from '@/middlewares/role/recruiter/cvtheque.middleware';
import {
  addCvThequeCritereValidation,
  contactCvAnonymValidation,
  resendCvThequeCritereValidation,
  updateCvThequeCritereValidation,
} from '@/validations/role/recruiter/cvtheque.validation';
import { resendCvThequeCritere } from '@/controllers/role/recruiter/cvtheque/resend-search.controller';

const router = Router();

router.post('/', addCvThequeCritereValidation, addCvThequeCritere);

router.get('/history', getCvThequeHistory);

router.get('/:id', checkCvCritereOwner, getCvThequeCritere);
router.get(
  '/:id/resend',
  resendCvThequeCritereValidation,
  checkCvCritereOwner,
  resendCvThequeCritere,
);
router.post('/:id/save', checkCvCritereOwner, saveCvThequeCritere);

router.post(
  '/:id/contact/:cvAnonymId',
  contactCvAnonymValidation,
  checkCvCritereOwner,
  contactCvAnonym,
);

router.get('/:id/cv-anonym/:cvAnonymId', checkCvCritereOwner, getCvAnonym);

router.put(
  '/:id',
  checkCvCritereOwner,
  updateCvThequeCritereValidation,
  updateCvThequeCritere,
);

export default router;
