import { Router } from 'express';
import { respondQualiCarriereQuestion } from '@/controllers/role/candidat/quali-carriere/respond-question.controller';
import { getQualiCarriereQuestion } from '@/controllers/role/candidat/quali-carriere/get-question.controller';
import {
  changeQualiCarriereStatus,
  editQualiCarriereCompetence,
  editQualiCarriereResume,
} from '@/controllers/role/candidat/quali-carriere/crud-quali-carriere.controller';
import { sendQualiCarriereMessage } from '@/controllers/role/candidat/quali-carriere/chat.controller';
import {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
  updateQualiCarriereCompetenceValidation,
  updateQualiCarriereResumeValidation,
} from '@/validations/role/candidat/quali-carriere.validation';
import { upload } from '@/lib/multer';
import { checkQualiCarriere } from '@/middlewares/role/candidat/candidat.middleware';

const router = Router();

// GET QUESTION
router.get('/', getQualiCarriereQuestion);

// CHANGE STATUS
router.post('/status', changeQualiCarriereStatus);

// SEND MESSAGE CHAT
router.post(
  '/message',
  senndQualiCarriereMessageValidation,
  checkQualiCarriere,
  sendQualiCarriereMessage,
);

// RESPOND QUESTION
router.post(
  '/:id',
  upload.single('file'),
  respondQualiCarriereQuestionValidation,
  checkQualiCarriere,
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
