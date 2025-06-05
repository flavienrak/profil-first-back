import express from 'express';

import { respondQualiCarriereQuestion } from '@/controllers/role/user/quali-carriere/respond-question.controller';
import { getQualiCarriereQuestion } from '@/controllers/role/user/quali-carriere/get-question.controller';
import {
  changeQualiCarriereStatus,
  editQualiCarriereCompetence,
  editQualiCarriereResume,
} from '@/controllers/role/user/quali-carriere/crud-quali-carriere.controller';
import { sendQualiCarriereMessage } from '@/controllers/role/user/quali-carriere/chat.controller';
import {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
  updateQualiCarriereCompetenceValidation,
  updateQualiCarriereResumeValidation,
} from '@/validations/role/user/quali-carriere.validation';
import { upload } from '@/lib/multer';

const router = express.Router();

// GET QUESTION
router.get('/', getQualiCarriereQuestion);

// CHANGE STATUS
router.post('/status', changeQualiCarriereStatus);

// SEND MESSAGE CHAT
router.post(
  '/message',
  senndQualiCarriereMessageValidation,
  sendQualiCarriereMessage,
);

// RESPOND QUESTION
router.post(
  '/:id',
  upload.single('file'),
  respondQualiCarriereQuestionValidation,
  respondQualiCarriereQuestion,
);

// EDIT COMPETENCE
router.put(
  '/competence',
  updateQualiCarriereCompetenceValidation,
  editQualiCarriereCompetence,
);

// EDIT RESUME
router.put(
  '/:id/resume',
  updateQualiCarriereResumeValidation,
  editQualiCarriereResume,
);

export default router;
