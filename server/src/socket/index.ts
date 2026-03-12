import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { AuthPayload } from '../middleware/auth';
import { setupChatHandlers } from './chat';
import { setupCallHandlers } from './call';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

const onlineUsers = new Map<string, string>(); // userId -> socketId

export function getOnlineUsers() {
  return onlineUsers;
}

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e8,
  });

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Необходима авторизация'));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret) as AuthPayload;
      socket.userId = payload.userId;
      socket.userEmail = payload.email;
      next();
    } catch {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    onlineUsers.set(userId, socket.id);

    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() },
    });

    // Join user's chat rooms
    const chatMembers = await prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true },
    });
    chatMembers.forEach((m) => socket.join(`chat:${m.chatId}`));

    io.emit('user:online', { userId });
    console.log(`User connected: ${userId}`);

    setupChatHandlers(io, socket as AuthenticatedSocket & { userId: string }, prisma);
    setupCallHandlers(io, socket as AuthenticatedSocket & { userId: string });

    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
      });
      io.emit('user:offline', { userId, lastSeen: new Date() });
      console.log(`User disconnected: ${userId}`);
    });
  });

  return io;
}
