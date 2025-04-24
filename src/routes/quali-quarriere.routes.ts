import express from 'express';
import multer from 'multer';

import { respondQualiCarriereQuestion } from '../controllers/quali-carriere.controller';
import { getQualiCarriereQuestion } from '../controllers/quali-carriere/get-question.controller';
import {
  editQualiCarriereCompetence,
  editQualiCarriereResume,
} from '../controllers/quali-carriere/edit-resume.controller';
import { sendQualiCarriereMessage } from '../controllers/quali-carriere/chat.controller';
import {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
  updateQualiCarriereCompetenceValidation,
  updateQualiCarriereResumeValidation,
} from '../validations/quali-carriere.validation';

const router = express.Router();
const upload = multer();

router.get('/', getQualiCarriereQuestion);

router.post(
  '/message',
  senndQualiCarriereMessageValidation,
  sendQualiCarriereMessage,
);

router.post(
  '/:id',
  upload.single('file'),
  respondQualiCarriereQuestionValidation,
  respondQualiCarriereQuestion,
);

router.put(
  '/competence',
  updateQualiCarriereCompetenceValidation,
  editQualiCarriereCompetence,
);

router.put(
  '/:id/resume',
  updateQualiCarriereResumeValidation,
  editQualiCarriereResume,
);

export default router;
