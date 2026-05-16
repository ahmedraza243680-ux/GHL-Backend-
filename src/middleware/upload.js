import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import multer from 'multer';

const uploadDir = join(tmpdir(), 'gbp-automation-uploads');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : 'jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  },
});

function imageFileFilter(_req, file, cb) {
  if (!file.mimetype?.startsWith('image/')) {
    cb(new Error('Only image uploads are allowed.'));
    return;
  }
  cb(null, true);
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single('file');
