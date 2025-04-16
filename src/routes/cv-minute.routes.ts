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
  updateSectionInfoScore,
  updateCvMinuteScore,
} from '../controllers/cv-minute.controller';
import {
  addCvMinuteValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteProfileValidation,
  updateSectionInfoOrderValidation,
  sectionInfoIdValidation,
} from '../validations/cv-minute.validation';
import { checkCvMinuteOwner } from '../middlewares/cvMinute.middleware';

const upload = multer();
const router = express.Router();

router.post('/', upload.single('file'), addCvMinuteValidation, addCvMinute);

router.get('/:id', checkCvMinuteOwner, getCvMinute);
router.put('/:id', checkCvMinuteOwner, updateCvMinuteScore);

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
  sectionInfoIdValidation,
  deleteCvMinuteSection,
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
