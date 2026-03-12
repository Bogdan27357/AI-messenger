import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { ollamaChat, ollamaChatWithContext } from '../services/ollama';
import { getRelevantDocuments } from '../services/knowledge';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { message, history } = req.body;

    const relevantDocs = await getRelevantDocuments(message);
    let response: string;

    if (relevantDocs.length > 0) {
      const context = relevantDocs
        .map((doc) => `[${doc.title}]: ${doc.content}`)
        .join('\n\n');
      response = await ollamaChatWithContext(message, context, history || []);
    } else {
      response = await ollamaChat(message, history || []);
    }

    res.json({ response, sources: relevantDocs.map((d) => ({ id: d.id, title: d.title })) });
  } catch (error: any) {
    console.error('AI chat error:', error);
    if (error.message?.includes('ECONNREFUSED')) {
      res.status(503).json({ error: 'Ollama не запущена. Запустите: docker-compose up ollama' });
    } else {
      res.status(500).json({ error: 'Ошибка AI-ассистента' });
    }
  }
});

router.post('/knowledge', adminMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const doc = await prisma.knowledgeDoc.create({
      data: {
        title: title || req.file?.originalname || 'Без названия',
        content: content || null,
        fileUrl: req.file ? `/uploads/knowledge/${req.file.filename}` : null,
        fileName: req.file?.originalname || null,
        fileSize: req.file?.size || null,
        uploadedBy: req.user!.userId,
      },
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/knowledge', async (_req: AuthRequest, res: Response) => {
  try {
    const docs = await prisma.knowledgeDoc.findMany({
      include: { uploader: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/knowledge/:id', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.knowledgeDoc.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Документ удалён' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
