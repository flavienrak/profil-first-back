import express from 'express';
import multer from 'multer';

import {
  getCvMinute,
  updateCvMinuteSection,
  updateCvMinuteSectionOrder,
  updateCvMinuteProfile,
  updateSectionInfoOrder,
  deleteSectionInfo,
  deleteCvMinuteSection,
  updateSectionInfoScore,
  updateCvMinuteScore,
  generateCvMinuteSectionAdvice,
  generateSectionInfoAdvice,
} from '../controllers/cv-minute.controller';
import { addCvMinute } from '../controllers/cv-minute/add-cv-minute.controller';
import { optimizeCvMinute } from '../controllers/cv-minute/optimize-cv-minute.controller';
import {
  addCvMinuteValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteProfileValidation,
  updateSectionInfoOrderValidation,
  sectionInfoIdValidation,
  generateSectionInfoAdviceValidation,
} from '../validations/cv-minute.validation';
import { checkCvMinuteOwner } from '../middlewares/cvMinute.middleware';

const upload = multer();
const router = express.Router();

router.post('/', upload.single('file'), addCvMinuteValidation, addCvMinute);

router.get('/:id', checkCvMinuteOwner, getCvMinute);
router.post('/:id', checkCvMinuteOwner, generateCvMinuteSectionAdvice);
router.put('/:id', checkCvMinuteOwner, updateCvMinuteScore);

router.put(
  '/:id/section',
  checkCvMinuteOwner,
  updateCvMinuteSectionValidation,
  updateCvMinuteSection,
);

router.post('/:id/optimize', checkCvMinuteOwner, optimizeCvMinute);

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
router.delete(
  '/:id/section/:cvMinuteSectionId',
  checkCvMinuteOwner,
  sectionInfoIdValidation,
  deleteCvMinuteSection,
);

router.put(
  '/:id/section-info/order',
  checkCvMinuteOwner,
  updateSectionInfoOrderValidation,
  updateSectionInfoOrder,
);

router.post(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  generateSectionInfoAdviceValidation,
  generateSectionInfoAdvice,
);
router.put(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  sectionInfoIdValidation,
  updateSectionInfoScore,
);
router.delete(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  sectionInfoIdValidation,
  deleteSectionInfo,
);

export default router;
