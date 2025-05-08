import express from 'express';
import multer from 'multer';

import {
  updateCvMinuteSection,
  updateSectionInfoScore,
  updateCvMinuteScore,
  generateCvMinuteSectionAdvice,
  generateSectionInfoAdvice,
} from '@/controllers/role/user/cv-minute/cv-minute.controller';
import { addCvMinute } from '@/controllers/role/user/cv-minute/add-cv-minute.controller';
import {
  copyCvMinute,
  deleteCvMinuteSection,
  deleteSectionInfo,
  getAllCvMinute,
  getCvMinute,
  updateCvMinuteName,
  updateCvMinuteProfile,
  updateCvMinuteSectionOrder,
  updateCvMinuteVisibility,
  updateSectionInfoOrder,
} from '@/controllers/role/user/cv-minute/crud-cv-minute.controller';
import { optimizeCvMinute } from '@/controllers/role/user/cv-minute/optimize-cv-minute.controller';
import {
  addCvMinuteValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteProfileValidation,
  updateSectionInfoOrderValidation,
  sectionInfoIdValidation,
  generateSectionInfoAdviceValidation,
  updateCvMinuteNameValidation,
  updateCvMinuteVisibilityValidation,
} from '@/validations/role/user/cv-minute.validation';
import { checkCvMinuteOwner } from '@/middlewares/role/user/cv-minute.middleware';

const upload = multer();
const router = express.Router();

// GET CVMINUTES
router.get('/', getAllCvMinute);

// ADD CV MINUTE
router.post('/', upload.single('file'), addCvMinuteValidation, addCvMinute);

// GET CV MINUTE
router.get('/:id', checkCvMinuteOwner, getCvMinute);

// GENERATE CVMINUTESECTION SUGGESTION
router.post('/:id', checkCvMinuteOwner, generateCvMinuteSectionAdvice);

// UPDATE CVMINUTE SCORE
router.put('/:id', checkCvMinuteOwner, updateCvMinuteScore);

// COPY CVMINUTE
router.post('/:id/copy', checkCvMinuteOwner, copyCvMinute);

// UPDATE CVMINUTE NAME
router.put('/:id/name', updateCvMinuteNameValidation, updateCvMinuteName);

// UPDATE CVMINUTE VISIBILITY
router.put(
  '/:id/visibility',
  updateCvMinuteVisibilityValidation,
  updateCvMinuteVisibility,
);

// UPDATE CVMINUTE SECTION
router.put(
  '/:id/section',
  updateCvMinuteSectionValidation,
  checkCvMinuteOwner,
  updateCvMinuteSection,
);

// OPTIMIZE CVMINUTE
router.post('/:id/optimize', checkCvMinuteOwner, optimizeCvMinute);

// UPDATE CVMINUTE PROFILE
router.post(
  '/:id/profile',
  upload.single('file'),
  updateCvMinuteProfileValidation,
  checkCvMinuteOwner,
  updateCvMinuteProfile,
);

// UPDATE CVMINUTE SECTION ORDER
router.put(
  '/:id/section/order',
  updateCvMinuteSectionOrderValidation,
  checkCvMinuteOwner,
  updateCvMinuteSectionOrder,
);

// DELETE CVMINUTE SECTION
router.delete(
  '/:id/section/:cvMinuteSectionId',
  sectionInfoIdValidation,
  checkCvMinuteOwner,
  deleteCvMinuteSection,
);

// UPDATE SECTIONINFO ORDER
router.put(
  '/:id/section-info/order',
  updateSectionInfoOrderValidation,
  checkCvMinuteOwner,
  updateSectionInfoOrder,
);

// GENERATE SECTIONINFO ADVICE
router.post(
  '/:id/section-info/:sectionInfoId',
  generateSectionInfoAdviceValidation,
  checkCvMinuteOwner,
  generateSectionInfoAdvice,
);

// UPDATE SECTIONINFO SCORE
router.put(
  '/:id/section-info/:sectionInfoId',
  sectionInfoIdValidation,
  checkCvMinuteOwner,
  updateSectionInfoScore,
);

// DELETE SECTIONINFO
router.delete(
  '/:id/section-info/:sectionInfoId',
  sectionInfoIdValidation,
  checkCvMinuteOwner,
  deleteSectionInfo,
);

export default router;
