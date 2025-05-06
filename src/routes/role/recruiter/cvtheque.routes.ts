import express from 'express';

import {
  addCvThequeCritere,
  saveCvThequeCritere,
  getCvThequeHistory,
  getCvAnonym,
} from '@/controllers/role/recruiter/cvtheque/crud-cvtheque.controller';
import { getCvThequeCritere } from '@/controllers/role/recruiter/cvtheque/get-critere.controller';
import { updateCvThequeCritere } from '@/controllers/role/recruiter/cvtheque/update-critere.controller';
import { checkCvCritereOwner } from '@/middlewares/role/recruiter/cvtheque.middleware';
import {
  addCvThequeCritereValidation,
  updateCvThequeCritereValidation,
} from '@/validations/role/recruiter/cvtheque.validation';

const router = express.Router();

router.post('/', addCvThequeCritereValidation, addCvThequeCritere);

router.get('/history', getCvThequeHistory);

router.get('/:id', checkCvCritereOwner, getCvThequeCritere);
router.post('/:id/save', checkCvCritereOwner, saveCvThequeCritere);

router.get('/:id/cv-anonym/:cvAnonymId', checkCvCritereOwner, getCvAnonym);

router.put(
  '/:id',
  checkCvCritereOwner,
  updateCvThequeCritereValidation,
  updateCvThequeCritere,
);

export default router;
