import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

import { app, server } from './socket';
import { checkUser, requireAuth } from './middlewares/auth.middleware';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import cvMinuteRoutes from './routes/cv-minute.routes';

dotenv.config();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/*', checkUser);

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Backend running successfully!');
});
app.get('/api/jwtid', requireAuth);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cv-minute', cvMinuteRoutes);

const port = process.env.BACKEND_PORT || 5000;
server.listen(port, () => console.log(`App runing at: ${port}`));
