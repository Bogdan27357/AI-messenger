import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware, adminMiddleware);

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, onlineUsers, totalChats, totalMessages] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isOnline: true } }),
      prisma.chat.count(),
      prisma.message.count(),
    ]);
    res.json({ totalUsers, onlineUsers, totalChats, totalMessages });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, name: true, displayName: true,
        avatar: true, role: true, isOnline: true, lastSeen: true, createdAt: true,
        _count: { select: { sentMessages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
