import express from 'express';

import { acceptConditions } from '@/controllers/role/user/user-role.controller';

const router = express.Router();

router.get('/accept-conditions', acceptConditions);

export default router;
