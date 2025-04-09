import express from 'express';
import multer from 'multer';

import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  getCvMinute,
  addCvMinute,
  addSections,
  updateCvMinuteSection,
  updateCvMinuteSectionOrder,
  updateCvMinuteProfile,
  updateSectionInfoOrder,
} from '../controllers/cv-minute.controller';
import {
  addCvMinuteValidation,
  addSectionsValidation,
  getCvMinuteValidation,
  updateCvMinuteSectionValidation,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteProfileValidation,
  updateSectionInfoOrderValidation,
} from '../validations/cv-minute.validation';

const upload = multer();
const router = express.Router();

router.get('/:id', isAuthenticated, getCvMinuteValidation, getCvMinute);
router.post(
  '/',
  upload.single('file'),
  isAuthenticated,
  addCvMinuteValidation,
  addCvMinute,
);

router.post(
  '/:id/section',
  isAuthenticated,
  addSectionsValidation,
  addSections,
);
router.post(
  '/:id/profile',
  upload.single('file'),
  isAuthenticated,
  updateCvMinuteProfileValidation,
  updateCvMinuteProfile,
);
router.put(
  '/:id/section',
  isAuthenticated,
  updateCvMinuteSectionValidation,
  updateCvMinuteSection,
);

router.put(
  '/section-info-order',
  isAuthenticated,
  updateSectionInfoOrderValidation,
  updateSectionInfoOrder,
);
router.put(
  '/section-order',
  isAuthenticated,
  updateCvMinuteSectionOrderValidation,
  updateCvMinuteSectionOrder,
);

export default router;
