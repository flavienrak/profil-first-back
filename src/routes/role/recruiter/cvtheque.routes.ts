import express from 'express';

import {
  addCvThequeCritere,
  addCvThequeHistory,
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

router.get('/:id', checkCvCritereOwner, getCvThequeCritere);

router.put(
  '/:id',
  checkCvCritereOwner,
  updateCvThequeCritereValidation,
  updateCvThequeCritere,
);

router.post('/:id/history', checkCvCritereOwner, addCvThequeHistory);

export default router;
