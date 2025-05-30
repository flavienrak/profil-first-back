import express from 'express';
import path from 'path';

import { app, logger, server } from '@/socket';
import { isAuthenticated } from '@/middlewares/auth.middleware';
import { checkUserRole } from '@/middlewares/role/user/user.middleware';
import { checkIsRecruiter } from '@/middlewares/role/recruiter/recruiter.middleware';

import authRoutes from '@/routes/auth.routes';
import allUserRoutes from '@/routes/all-user.routes';

import userRoleRoutes from '@/routes/role/user/user-role.routes';
import cvMinuteRoutes from '@/routes/role/user/cv-minute.routes';
import qualiCarriereRoutes from '@/routes/role/user/quali-quarriere.routes';

import cvThequeRoutes from '@/routes/role/recruiter/cvtheque.routes';
import crossSourcingRoutes from '@/routes/role/recruiter/cross-sourcing.routes';

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Backend running successfully!');
});

app.use('/api/auth', authRoutes);
app.use('/api/user', isAuthenticated, allUserRoutes);

// USER ROLE ROUTES
app.use('/api/role/user', isAuthenticated, userRoleRoutes);
app.use(
  '/api/role/user/cv-minute',
  isAuthenticated,
  checkUserRole,
  cvMinuteRoutes,
);
app.use(
  '/api/role/user/quali-carriere',
  isAuthenticated,
  checkUserRole,
  qualiCarriereRoutes,
);

// RECRUITER ROLE ROUTES
app.use(
  '/api/role/recruiter/cvtheque',
  isAuthenticated,
  checkIsRecruiter,
  cvThequeRoutes,
);
app.use(
  '/api/role/recruiter/cross-sourcing',
  isAuthenticated,
  checkIsRecruiter,
  crossSourcingRoutes,
);

const port = process.env.BACKEND_PORT;
if (!port) {
  logger.error('ENV NOT FOUND');
} else {
  server.listen(port, () => logger.info(`App runing at: ${port}`));
}
