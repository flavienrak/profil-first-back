import express from 'express';
import multer from 'multer';

import { respondQualiCarriereQuestion } from '../controllers/user/quali-carriere/respond-question.controller';
import { getQualiCarriereQuestion } from '../controllers/user/quali-carriere/get-question.controller';
import {
  changeQualiCarriereStatus,
  editQualiCarriereCompetence,
  editQualiCarriereResume,
} from '../controllers/user/quali-carriere/crud-quali-carriere.controller';
import { sendQualiCarriereMessage } from '../controllers/user/quali-carriere/chat.controller';
import {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
  updateQualiCarriereCompetenceValidation,
  updateQualiCarriereResumeValidation,
} from '../validations/quali-carriere.validation';

const router = express.Router();
const upload = multer();

router.get('/', getQualiCarriereQuestion);

router.post('/status', changeQualiCarriereStatus);
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
