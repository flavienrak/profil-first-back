import express from 'express';
import multer from 'multer';

import {
  updateCvMinuteSection,
  updateSectionInfoScore,
  updateCvMinuteScore,
  generateCvMinuteSectionAdvice,
  generateSectionInfoAdvice,
} from '../../../controllers/role/user/cv-minute/cv-minute.controller';
import { addCvMinute } from '../../../controllers/role/user/cv-minute/add-cv-minute.controller';
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
} from '../../../controllers/role/user/cv-minute/crud-cv-minute.controller';
import { optimizeCvMinute } from '../../../controllers/role/user/cv-minute/optimize-cv-minute.controller';
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
} from '../../../validations/role/user/cv-minute.validation';
import { checkCvMinuteOwner } from '../../../middlewares/role/user/cv-minute.middleware';

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
  checkCvMinuteOwner,
  updateCvMinuteSectionValidation,
  updateCvMinuteSection,
);

// OPTIMIZE CVMINUTE
router.post('/:id/optimize', checkCvMinuteOwner, optimizeCvMinute);

// UPDATE CVMINUTE PROFILE
router.post(
  '/:id/profile',
  upload.single('file'),
  checkCvMinuteOwner,
  updateCvMinuteProfileValidation,
  updateCvMinuteProfile,
);

// UPDATE CVMINUTE SECTION ORDER
router.put(
  '/:id/section/order',
  checkCvMinuteOwner,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteSectionOrder,
);

// DELETE CVMINUTE SECTION
router.delete(
  '/:id/section/:cvMinuteSectionId',
  checkCvMinuteOwner,
  sectionInfoIdValidation,
  deleteCvMinuteSection,
);

// UPDATE SECTIONINFO ORDER
router.put(
  '/:id/section-info/order',
  checkCvMinuteOwner,
  updateSectionInfoOrderValidation,
  updateSectionInfoOrder,
);

// GENERATE SECTIONINFO ADVICE
router.post(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  generateSectionInfoAdviceValidation,
  generateSectionInfoAdvice,
);

// UPDATE SECTIONINFO SCORE
router.put(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  sectionInfoIdValidation,
  updateSectionInfoScore,
);

// DELETE SECTIONINFO
router.delete(
  '/:id/section-info/:sectionInfoId',
  checkCvMinuteOwner,
  sectionInfoIdValidation,
  deleteSectionInfo,
);

export default router;
