import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import sequelize from './db';

import { app, server } from './socket';
import { checkUser, requireAuth } from './middlewares/auth.middleware';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';

dotenv.config();

// Synchronize PostgresSQL
sequelize.sync().then(() => console.log('PostgresSQL synchronized'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/*', checkUser);

app.get('/', (req: Request, res: Response) => {
  res.send('Backend running successfully!');
});
app.get('/api/jwtid', requireAuth);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

const port = process.env.BACKEND_PORT || 5000;
server.listen(port, () => console.log(`App runing at: ${port}`));
