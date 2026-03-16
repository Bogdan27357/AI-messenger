import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { searchDocuments } from './qdrant';

export async function getRelevantDocuments(query: string) {
  return searchDocuments(query, 5);
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
