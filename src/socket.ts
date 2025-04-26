import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import compression from 'compression';
import OpenAI from 'openai';
import { Server, Socket } from 'socket.io';

dotenv.config();
const app = express();

app.use(
  cors({
    // origin: ["http://localhost:5173"],
    origin: (origin, callback) => {
      if (origin) {
        callback(null, origin);
      } else {
        callback(null, '*');
      }
    },
    credentials: true,
    preflightContinue: false,
    allowedHeaders: ['sessionId', 'Content-Type'],
    exposedHeaders: ['sessionId'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }),
);
app.use(compression());
app.use(express.json());
app.use(cookieParser());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const allUsers = new Map<string, { socket: Socket; count: number }>();

io.on('connection', (socket: Socket) => {
  const userId = socket.handshake.query.id as string | undefined;

  if (userId) {
    if (allUsers.has(userId)) {
      const userData = allUsers.get(userId);
      userData.count += 1;
      allUsers.set(userId, userData);
    } else {
      allUsers.set(userId, { socket, count: 1 });
    }

    socket.join(`user-${userId}`);

    io.emit('getOnlineUsers', Array.from(allUsers.keys()));

    socket.on('disconnect', async () => {
      if (allUsers.has(userId)) {
        const userData = allUsers.get(userId);

        userData.count -= 1;

        if (userData.count === 0) {
          allUsers.delete(userId);
        } else {
          allUsers.set(userId, userData);
        }
      }
      io.emit('getOnlineUsers', Array.from(allUsers.keys()));
    });
  }
});

function getReceiver(id: string | number) {
  return allUsers.get(String(id));
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

export { app, openai, logger, io, server, getReceiver };
