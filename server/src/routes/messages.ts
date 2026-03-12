import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }
    const type = (req.query.type as string) || 'attachments';
    const fileUrl = `/uploads/${type}/${req.file.filename}`;
    res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id as string } });
    if (!message || message.senderId !== req.user!.userId) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }
    const updated = await prisma.message.update({
      where: { id: req.params.id as string },
      data: { content: req.body.content, isEdited: true },
      include: {
        sender: { select: { id: true, name: true, displayName: true, avatar: true } },
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id as string } });
    if (!message) {
      res.status(404).json({ error: 'Сообщение не найдено' });
      return;
    }
    if (message.senderId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }
    await prisma.message.update({
      where: { id: req.params.id as string },
      data: { isDeleted: true, content: null, fileUrl: null },
    });
    res.json({ message: 'Сообщение удалено' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/reaction', async (req: AuthRequest, res: Response) => {
  try {
    const { emoji } = req.body;
    const existing = await prisma.reaction.findFirst({
      where: { messageId: req.params.id as string, userId: req.user!.userId, emoji },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      res.json({ removed: true });
    } else {
      const reaction = await prisma.reaction.create({
        data: { messageId: req.params.id as string, userId: req.user!.userId, emoji },
        include: { user: { select: { id: true, name: true } } },
      });
      res.json(reaction);
    }
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
