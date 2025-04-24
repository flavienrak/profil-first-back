import express from 'express';
import multer from 'multer';

import {
  respondQualiCarriereQuestion,
  sendQualiCarriereMessage,
} from '../controllers/quali-carriere.controller';
import { getQualiCarriereQuestion } from '../controllers/quali-carriere/get-question.controller';
import {
  respondQualiCarriereQuestionValidation,
  senndQualiCarriereMessageValidation,
} from '../validations/quali-carriere.validation';

const router = express.Router();
const upload = multer();

router.get('/', getQualiCarriereQuestion);
router.post('/', senndQualiCarriereMessageValidation, sendQualiCarriereMessage);
router.post(
  '/:id',
  upload.single('file'),
  respondQualiCarriereQuestionValidation,
  respondQualiCarriereQuestion,
);

export default router;
