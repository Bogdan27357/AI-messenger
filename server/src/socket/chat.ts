import { Server, Socket } from 'socket.io';
import { PrismaClient, MessageType } from '@prisma/client';

interface AuthSocket extends Socket {
  userId: string;
}

export function setupChatHandlers(io: Server, socket: AuthSocket, prisma: PrismaClient) {
  socket.on('chat:message', async (data) => {
    try {
      const { chatId, type, content, fileUrl, fileName, fileSize, duration, replyToId } = data;

      const message = await prisma.message.create({
        data: {
          chatId,
          senderId: socket.userId,
          type: (type as MessageType) || 'TEXT',
          content,
          fileUrl,
          fileName,
          fileSize,
          duration,
          replyToId,
        },
        include: {
          sender: { select: { id: true, name: true, displayName: true, avatar: true } },
          replyTo: {
            include: { sender: { select: { id: true, name: true } } },
          },
          reactions: true,
          reads: true,
        },
      });

      await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      io.to(`chat:${chatId}`).emit('chat:message', message);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Ошибка отправки сообщения' });
    }
  });

  socket.on('chat:typing', (data) => {
    const { chatId } = data;
    socket.to(`chat:${chatId}`).emit('chat:typing', {
      chatId,
      userId: socket.userId,
    });
  });

  socket.on('chat:typing:stop', (data) => {
    const { chatId } = data;
    socket.to(`chat:${chatId}`).emit('chat:typing:stop', {
      chatId,
      userId: socket.userId,
    });
  });

  socket.on('chat:read', async (data) => {
    try {
      const { chatId, messageId } = data;

      await prisma.messageRead.upsert({
        where: {
          messageId_userId: { messageId, userId: socket.userId },
        },
        create: { messageId, userId: socket.userId },
        update: { readAt: new Date() },
      });

      io.to(`chat:${chatId}`).emit('chat:read', {
        chatId,
        messageId,
        userId: socket.userId,
        readAt: new Date(),
      });
    } catch (error) {
      console.error('Read message error:', error);
    }
  });

  socket.on('chat:reaction', async (data) => {
    try {
      const { chatId, messageId, emoji } = data;

      const existing = await prisma.reaction.findFirst({
        where: { messageId, userId: socket.userId, emoji },
      });

      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
        io.to(`chat:${chatId}`).emit('chat:reaction', {
          chatId, messageId, userId: socket.userId, emoji, removed: true,
        });
      } else {
        const reaction = await prisma.reaction.create({
          data: { messageId, userId: socket.userId, emoji },
          include: { user: { select: { id: true, name: true } } },
        });
        io.to(`chat:${chatId}`).emit('chat:reaction', {
          chatId, messageId, userId: socket.userId, emoji, removed: false, reaction,
        });
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }
  });

  socket.on('chat:join', (data) => {
    socket.join(`chat:${data.chatId}`);
  });
}
