import http from 'http';
import path from 'path';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import OpenAI from 'openai';

import { Server, Socket } from 'socket.io';
import { frontendUri, openaiApiKey, stripeSecretKey } from '@/utils/env';

dotenv.config();
const app = express();

app.use(
  cors({
    origin: [frontendUri],
    credentials: true,
    preflightContinue: false,
    allowedHeaders: ['sessionId', 'Content-Type'],
    exposedHeaders: ['sessionId'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }),
);
app.use(helmet());
app.use(compression());
app.set('trust proxy', 1);
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (req: Request, res: Response) => {
  res.send('Backend running successfully!');
});

app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Max requests authorized',
  }),
);

const openai = new OpenAI({ apiKey: openaiApiKey });

const stripe = new Stripe(stripeSecretKey);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const allUsers = new Map<string, { socket: Socket; count: number }>();

io.on('connection', async (socket: Socket) => {
  const userId = socket.handshake.query.id as string | undefined;

  if (!userId) return;

  const existingUser = allUsers.get(userId);

  if (existingUser) {
    existingUser.count += 1;
  } else {
    allUsers.set(userId, { socket, count: 1 });
  }

  await socket.join(`user-${userId}`);

  io.emit('roomJoined');
  io.emit('getOnlineUsers', Array.from(allUsers.keys()));

  socket.on('disconnect', async () => {
    const userData = allUsers.get(userId);
    if (!userData) return;

    userData.count -= 1;

    if (userData.count <= 0) {
      allUsers.delete(userId);
    } else {
      allUsers.set(userId, userData);
    }

    io.emit('getOnlineUsers', Array.from(allUsers.keys()));
  });
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

export { app, openai, stripe, logger, io, server };
