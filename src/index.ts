import express from 'express';
import path from 'path';

import { app, logger, server } from './socket';
import { checkUser, isAuthenticated } from './middlewares/auth.middleware';
import { checkUserRole } from './middlewares/role/user/user.middleware';
import { checkIsRecruiter } from './middlewares/role/recruiter/recruiter.middleware';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/all-user.routes';

import cvMinuteRoutes from './routes/role/user/cv-minute.routes';
import qualiCarriereRoutes from './routes/role/user/quali-quarriere.routes';

import cvThequeRoutes from './routes/role/recruiter/cvtheque.routes';

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/*', checkUser);

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Backend running successfully!');
});

app.use('/api/auth', authRoutes);

app.use('/api/user', isAuthenticated, userRoutes);

// CVMINUTE ROUTES
app.use(
  '/api/role/user/cv-minute',
  isAuthenticated,
  checkUserRole,
  cvMinuteRoutes,
);

// QUALI CARRIERE ROUTES
app.use(
  '/api/role/user/quali-carriere',
  isAuthenticated,
  checkUserRole,
  qualiCarriereRoutes,
);

// CVTHEQUE ROUTES
app.use(
  '/api/role/recruiter/cvtheque',
  isAuthenticated,
  checkIsRecruiter,
  cvThequeRoutes,
);

const port = process.env.BACKEND_PORT || 5000;
server.listen(port, () => logger.info(`App runing at: ${port}`));
