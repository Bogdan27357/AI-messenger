import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, name: true, displayName: true,
        avatar: true, role: true, isOnline: true, lastSeen: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true, email: true, name: true, displayName: true,
        avatar: true, role: true, isOnline: true, lastSeen: true, createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const isSelf = req.user!.userId === req.params.id as string;
    if (!isAdmin && !isSelf) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    const { name, displayName, email } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (displayName !== undefined) data.displayName = displayName;
    if (email && isAdmin) data.email = email;

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      select: {
        id: true, email: true, name: true, displayName: true,
        avatar: true, role: true, isOnline: true, lastSeen: true,
      },
      data,
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: role || 'USER' },
      select: {
        id: true, email: true, name: true, displayName: true,
        avatar: true, role: true, isOnline: true, lastSeen: true, createdAt: true,
      },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/avatar', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const isSelf = req.user!.userId === req.params.id as string;
    const isAdmin = req.user!.role === 'ADMIN';
    if (!isSelf && !isAdmin) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
