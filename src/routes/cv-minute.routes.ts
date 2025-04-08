import express from 'express';
import multer from 'multer';

import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  getCvMinute,
  addCvMinute,
  addSections,
  updateSection,
  updateSectionsOrder,
} from '../controllers/cv-minute.controller';
import {
  addCvMinuteValidation,
  addSectionsValidation,
  getCvMinuteValidation,
  udpateSectionValidation,
  udpateSectionsOrderValidation,
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
router.put(
  '/:id/section',
  isAuthenticated,
  udpateSectionValidation,
  updateSection,
);
router.put(
  '/:id/section-order',
  isAuthenticated,
  udpateSectionsOrderValidation,
  updateSectionsOrder,
);

export default router;
