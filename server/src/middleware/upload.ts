import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { config } from '../config';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = (req.query.type as string) || 'attachments';
    const allowed = ['avatars', 'attachments', 'voice', 'video', 'knowledge'];
    const folder = allowed.includes(type) ? type : 'attachments';
    const dest = path.join(config.upload.dir, folder);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
});
