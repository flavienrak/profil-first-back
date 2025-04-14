import express from 'express';
import multer from 'multer';

import {
  getCvMinute,
  addCvMinute,
  updateCvMinuteSection,
  updateCvMinuteSectionOrder,
  updateCvMinuteProfile,
  updateSectionInfoOrder,
  deleteSectionInfo,
  deleteCvMinuteSection,
  openaiController,
} from '../controllers/cv-minute.controller';
import {
  addCvMinuteValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteProfileValidation,
  updateSectionInfoOrderValidation,
} from '../validations/cv-minute.validation';
import { checkCvMinuteOwner } from '../middlewares/cvMinute.middleware';

const upload = multer();
const router = express.Router();

router.get('/:id', checkCvMinuteOwner, getCvMinute);
router.post('/', upload.single('file'), addCvMinuteValidation, addCvMinute);

router.post('/openai', openaiController);

router.put(
  '/:id/section',
  checkCvMinuteOwner,
  updateCvMinuteSectionValidation,
  updateCvMinuteSection,
);

router.post(
  '/:id/profile',
  upload.single('file'),
  checkCvMinuteOwner,
  updateCvMinuteProfileValidation,
  updateCvMinuteProfile,
);

router.put(
  '/:id/section/order',
  checkCvMinuteOwner,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteSectionOrder,
);
router.put(
  '/:id/section-info/order',
  checkCvMinuteOwner,
  updateSectionInfoOrderValidation,
  updateSectionInfoOrder,
);

router.delete(
  '/:id/section/:cvMinuteSectionId',
  checkCvMinuteOwner,
  deleteCvMinuteSection,
);
router.delete(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  deleteSectionInfo,
);

export default router;
