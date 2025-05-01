import express from 'express';

import {
  addCvCritere,
  getCvCritere,
  updateCvCritere,
} from '../../../controllers/role/recruiter/cvtheque/crud-cvtheque.controller';
import { checkCvCritereOwner } from '../../../middlewares/role/recruiter/cvtheque.middleware';

const router = express.Router();

router.post('/', addCvCritere);

router.get('/:id', checkCvCritereOwner, getCvCritere);
router.put('/:id', checkCvCritereOwner, updateCvCritere);

export default router;
