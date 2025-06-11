import express from 'express';

import {
  updateCvMinuteSection,
  updateCvMinuteSectionScore,
  updateCvMinuteScore,
  generateNewCvMinuteSections,
  generateCvMinuteSectionAdvices,
} from '@/controllers/role/user/cv-minute/cv-minute.controller';
import { addCvMinute } from '@/controllers/role/user/cv-minute/add-cv-minute.controller';
import {
  copyCvMinute,
  deleteCvMinute,
  deleteCvMinuteSection,
  getAllCvMinute,
  getCvMinute,
  updateCvMinuteName,
  updateCvMinuteProfile,
  updateCvMinuteSectionOrder,
  updateCvMinuteVisibility,
} from '@/controllers/role/user/cv-minute/crud-cv-minute.controller';
import { optimizeCvMinute } from '@/controllers/role/user/cv-minute/optimize-cv-minute.controller';
import {
  addCvMinuteValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteProfileValidation,
  cvMinuteSectionIdValidation,
  updateCvMinuteNameValidation,
  updateCvMinuteVisibilityValidation,
  deleteCvMinuteIdValidation,
} from '@/validations/role/user/cv-minute.validation';
import {
  checkCvMinuteOwner,
  checkCvMinuteSection,
} from '@/middlewares/role/user/cv-minute.middleware';
import { upload } from '@/lib/multer';

const router = express.Router();

// GET CVMINUTES
router.get('/', getAllCvMinute);

// ADD CV MINUTE
router.post('/', upload.single('file'), addCvMinuteValidation, addCvMinute);

// GET CV MINUTE
router.get('/:id', checkCvMinuteOwner, getCvMinute);

// DELETE CVMINUTE
router.delete('/:id', deleteCvMinuteIdValidation, deleteCvMinute);

// GENERATE NEW CVMINUTE SECTION SUGGESTIONS
router.post(
  '/:id/suggestions',
  checkCvMinuteOwner,
  generateNewCvMinuteSections,
);

// UPDATE CVMINUTE SCORE
router.put('/:id/score', checkCvMinuteOwner, updateCvMinuteScore);

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
  '/:id/cv-minute-section',
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
  '/:id/cv-minute-section/order',
  updateCvMinuteSectionOrderValidation,
  checkCvMinuteOwner,
  updateCvMinuteSectionOrder,
);

// GENERATE CVMINUTE SECTION ADVICES
router.post(
  '/:id/cv-minute-section/:cvMinuteSectionId/advices',
  cvMinuteSectionIdValidation,
  checkCvMinuteOwner,
  checkCvMinuteSection,
  generateCvMinuteSectionAdvices,
);

// UPDATE CVMINUTE SECTION SCORE
router.put(
  '/:id/cv-minute-section/:cvMinuteSectionId/score',
  cvMinuteSectionIdValidation,
  checkCvMinuteOwner,
  checkCvMinuteSection,
  updateCvMinuteSectionScore,
);

// DELETE CVMINUTE SECTION
router.delete(
  '/:id/cv-minute-section/:cvMinuteSectionId',
  cvMinuteSectionIdValidation,
  checkCvMinuteOwner,
  checkCvMinuteSection,
  deleteCvMinuteSection,
);

export default router;
