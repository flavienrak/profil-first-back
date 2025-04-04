import express from 'express';

import { isAuthenticated } from '../middlewares/auth.middleware';
import {
  addSections,
  sectionRelations,
  updateSectionOrder,
  updateSectionTitle,
} from '../controllers/section.controller';
import {
  addSectionsValidation,
  sectionRelationsValidation,
  udpateSectionOrderValidation,
  udpateSectionTitleValidation,
} from '../validations/cv-minute.validation';

const router = express.Router();

router.post(
  '/:cvMinuteId/section',
  isAuthenticated,
  addSectionsValidation,
  addSections,
);
router.put(
  '/:cvMinuteId/section-title',
  isAuthenticated,
  udpateSectionTitleValidation,
  updateSectionTitle,
);
router.put(
  '/:cvMinuteId/section-order',
  isAuthenticated,
  udpateSectionOrderValidation,
  updateSectionOrder,
);

router.post(
  '/:cvMinuteId/section-relation',
  isAuthenticated,
  sectionRelationsValidation,
  sectionRelations,
);

export default router;
