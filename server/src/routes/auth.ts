import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function generateTokens(userId: string, email: string, role: string) {
  const accessToken = jwt.sign({ userId, email, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId, email, role }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as string,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, accessToken, refreshToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(401).json({ error: 'Требуется refresh token' });
      return;
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Недействительный refresh token' });
      return;
    }

    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
    const tokens = generateTokens(payload.userId, payload.email, payload.role);

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: payload.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Недействительный refresh token' });
  }
});

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { isOnline: false, lastSeen: new Date() },
    });
    res.json({ message: 'Выход выполнен' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
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

export default router;
