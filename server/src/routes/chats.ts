import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId: req.user!.userId } } },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, displayName: true, avatar: true, isOnline: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await prisma.message.count({
          where: {
            chatId: chat.id,
            senderId: { not: req.user!.userId },
            reads: { none: { userId: req.user!.userId } },
          },
        });
        return { ...chat, unreadCount };
      })
    );

    res.json(chatsWithUnread);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type, name, memberIds } = req.body;
    const userId = req.user!.userId;

    if (type === 'DIRECT') {
      const otherUserId = memberIds[0];
      const existing = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherUserId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, displayName: true, avatar: true, isOnline: true },
              },
            },
          },
        },
      });
      if (existing) {
        res.json(existing);
        return;
      }
    }

    const chat = await prisma.chat.create({
      data: {
        type: type || 'DIRECT',
        name: type === 'GROUP' ? name : null,
        createdBy: userId,
        members: {
          create: [
            { userId, role: 'OWNER' },
            ...memberIds.map((id: string) => ({ userId: id, role: 'MEMBER' as const })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, displayName: true, avatar: true, isOnline: true },
            },
          },
        },
      },
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: req.params.id as string,
        members: { some: { userId: req.user!.userId } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, displayName: true, avatar: true, isOnline: true, lastSeen: true },
            },
          },
        },
      },
    });
    if (!chat) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { cursor, limit = '50' } = req.query;
    const take = parseInt(limit as string, 10);

    const messages = await prisma.message.findMany({
      where: { chatId: req.params.id as string, isDeleted: false },
      include: {
        sender: { select: { id: true, name: true, displayName: true, avatar: true } },
        replyTo: {
          include: { sender: { select: { id: true, name: true } } },
        },
        reactions: {
          include: { user: { select: { id: true, name: true } } },
        },
        reads: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
    });

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/messages/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      res.json([]);
      return;
    }
    const messages = await prisma.message.findMany({
      where: {
        chatId: req.params.id as string,
        isDeleted: false,
        content: { contains: q as string, mode: 'insensitive' },
      },
      include: {
        sender: { select: { id: true, name: true, displayName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
