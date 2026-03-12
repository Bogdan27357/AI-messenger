import { Server, Socket } from 'socket.io';
import { getOnlineUsers } from './index';

interface AuthSocket extends Socket {
  userId: string;
}

export function setupCallHandlers(io: Server, socket: AuthSocket) {
  const onlineUsers = getOnlineUsers();

  socket.on('call:initiate', (data) => {
    const { targetUserId, type } = data; // type: 'voice' | 'video'
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:incoming', {
        callerId: socket.userId,
        type,
      });
    } else {
      socket.emit('call:unavailable', { targetUserId });
    }
  });

  socket.on('call:accept', (data) => {
    const { callerId } = data;
    const callerSocketId = onlineUsers.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:accepted', { userId: socket.userId });
    }
  });

  socket.on('call:reject', (data) => {
    const { callerId } = data;
    const callerSocketId = onlineUsers.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:rejected', { userId: socket.userId });
    }
  });

  socket.on('call:end', (data) => {
    const { targetUserId } = data;
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:ended', { userId: socket.userId });
    }
  });

  socket.on('call:offer', (data) => {
    const { targetUserId, offer } = data;
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:offer', { userId: socket.userId, offer });
    }
  });

  socket.on('call:answer', (data) => {
    const { targetUserId, answer } = data;
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:answer', { userId: socket.userId, answer });
    }
  });

  socket.on('call:ice-candidate', (data) => {
    const { targetUserId, candidate } = data;
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:ice-candidate', { userId: socket.userId, candidate });
    }
  });
}
