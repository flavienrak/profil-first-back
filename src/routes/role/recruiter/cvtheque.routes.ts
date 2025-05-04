import express from 'express';

import {
  addCvThequeCritere,
  addCvThequeHistory,
  getCvThequeHistory,
  getCvAnonym,
  updateCvThequeCritere,
} from '../../../controllers/role/recruiter/cvtheque/crud-cvtheque.controller';
import { getCvThequeCritere } from '../../../controllers/role/recruiter/cvtheque/get-critere.controller';
import { checkCvCritereOwner } from '../../../middlewares/role/recruiter/cvtheque.middleware';
import {
  addCvThequeCritereValidation,
  updateCvThequeCritereValidation,
} from '../../../validations/role/recruiter/cvtheque.validation';

const router = express.Router();

router.post('/', addCvThequeCritereValidation, addCvThequeCritere);

router.get('/history', getCvThequeHistory);
router.post('/history/:id', checkCvCritereOwner, addCvThequeHistory);

router.get('/:id', checkCvCritereOwner, getCvThequeCritere);

router.get('/:id/cv-anonym/:cvAnonymId', checkCvCritereOwner, getCvAnonym);

router.put(
  '/:id',
  checkCvCritereOwner,
  updateCvThequeCritereValidation,
  updateCvThequeCritere,
);

export default router;
