import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const prisma = new PrismaClient();

export async function getRelevantDocuments(query: string) {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/).filter((w) => w.length > 2);

  const docs = await prisma.knowledgeDoc.findMany();

  const scored = docs.map((doc) => {
    let score = 0;
    const content = `${doc.title} ${doc.content || ''}`.toLowerCase();

    for (const word of words) {
      if (content.includes(word)) {
        score += 1;
        if (doc.title.toLowerCase().includes(word)) {
          score += 2;
        }
      }
    }
    return { ...doc, score };
  });

  return scored
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _, ...doc }) => doc);
}

export async function extractTextFromFile(filePath: string): Promise<string> {
  const fullPath = path.join(config.upload.dir, filePath.replace('/uploads/', ''));
  if (!fs.existsSync(fullPath)) return '';

  const ext = path.extname(fullPath).toLowerCase();
  if (['.txt', '.md', '.csv', '.json', '.html', '.xml'].includes(ext)) {
    return fs.readFileSync(fullPath, 'utf-8');
  }

  return '';
}
