import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { getPublicApiBaseUrl } from '../utils/email-unsubscribe';

const multer = require('multer');

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const MAX_BYTES = 8 * 1024 * 1024;

export const publicImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
}).single('file');

function imageDir(tenantId: number) {
  const dir = path.join(process.cwd(), 'uploads', 'email-images', String(tenantId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function publicUrl(tenantId: number, filename: string) {
  const relative = `/uploads/email-images/${tenantId}/${filename}`;
  return {
    relative,
    url: `${getPublicApiBaseUrl()}${relative}`,
  };
}

export async function savePublicImage(req: Request, res: Response) {
  const tenantId = Number((req as any).tenant?.id);
  if (!tenantId) {
    return res.status(401).json({ success: false, error: 'Chave de API inválida' });
  }

  try {
    let buffer: Buffer | null = null;
    let mime = '';
    let ext = '';
    let original = 'imagem';

    if (req.file) {
      mime = String(req.file.mimetype || '').toLowerCase();
      ext = IMAGE_TYPES[mime] || '';
      buffer = req.file.buffer;
      original = req.file.originalname || 'imagem';
    } else {
      const raw = String(req.body?.data_base64 || req.body?.image_base64 || req.body?.base64 || '');
      const dataUrl = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
      const encoded = (dataUrl ? dataUrl[2] : raw).replace(/\s/g, '');
      mime = (dataUrl ? dataUrl[1] : String(req.body?.content_type || req.body?.mimetype || '')).toLowerCase();
      ext = IMAGE_TYPES[mime] || '';
      if (encoded) buffer = Buffer.from(encoded, 'base64');
      original = String(req.body?.filename || 'imagem');
    }

    if (!buffer || !buffer.length || !ext) {
      return res.status(400).json({
        success: false,
        error: 'Envie uma imagem JPG, PNG, GIF ou WEBP no campo file, ou em JSON no campo data_base64.',
      });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ success: false, error: 'Imagem muito grande. Tamanho máximo: 8MB.' });
    }

    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(imageDir(tenantId), filename), buffer);
    const stored = publicUrl(tenantId, filename);

    return res.json({
      success: true,
      url: stored.url,
      path: stored.relative,
      filename,
      original_name: original,
      mimetype: mime,
      size: buffer.length,
    });
  } catch (error: any) {
    console.error('Erro ao guardar imagem pública:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Não foi possível guardar a imagem.' });
  }
}
