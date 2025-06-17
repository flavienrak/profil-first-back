import { app, logger, server } from '@/socket';
import { isAuthenticated } from '@/middlewares/auth.middleware';
import { checkUserRole } from '@/middlewares/role/candidat/candidat.middleware';
import { checkIsRecruiter } from '@/middlewares/role/recruiter/recruiter.middleware';

import authRoutes from '@/routes/auth.routes';
import userRoutes from '@/routes/user.routes';
import paymentRoutes from '@/routes/payment.routes';

import candidatRoutes from '@/routes/role/candidat/candidat.routes';
import cvMinuteRoutes from '@/routes/role/candidat/cv-minute.routes';
import qualiCarriereRoutes from '@/routes/role/candidat/quali-quarriere.routes';

import cvThequeRoutes from '@/routes/role/recruiter/cvtheque.routes';
import crossSourcingRoutes from '@/routes/role/recruiter/cross-sourcing.routes';

app.use('/api/auth', authRoutes);
app.use('/api/user', isAuthenticated, userRoutes);
app.use('/api/payment', isAuthenticated, paymentRoutes);

// CANDIDAT ROUTES
app.use('/api/role/candidat', isAuthenticated, candidatRoutes);
app.use(
  '/api/role/candidat/cv-minute',
  isAuthenticated,
  checkUserRole,
  cvMinuteRoutes,
);
app.use(
  '/api/role/candidat/quali-carriere',
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
