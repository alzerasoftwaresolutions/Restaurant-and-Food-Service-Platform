import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mediaService } from '../../platform/media/mediaService.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { auditAction } from '../middleware/auditMiddleware.js';
import { config } from '../../config/appConfig.js';

// Ensure upload directory exists
if (!fs.existsSync(config.media.uploadDir)) {
  fs.mkdirSync(config.media.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.media.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = randomUUID().replace(/-/g, '').slice(0, 12);
    cb(null, `med_${Date.now()}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.media.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (config.media.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${config.media.allowedMimeTypes.join(', ')}`));
    }
  }
});

const router = Router();

// GET /api/v1/media (list reusable assets)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { assetType } = req.query;
    const assets = await mediaService.listMediaAssets({ assetType });
    res.json({ success: true, data: assets });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/media/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const asset = await mediaService.getMediaAsset(req.params.id);
    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/media/upload
router.post(
  '/upload',
  authenticate,
  requireRole('admin', 'manager'),
  upload.single('file'),
  auditAction('MEDIA_UPLOAD', 'MEDIA', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No media file provided' });
      }

      const { assetType = 'general', altText } = req.body;
      const asset = await mediaService.registerUploadedFile(req.file, { assetType, altText });

      res.status(201).json({ success: true, data: asset });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/media/:id
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MEDIA_DELETE', 'MEDIA', req => req.params.id),
  async (req, res, next) => {
    try {
      const result = await mediaService.deleteMediaAsset(req.params.id);
      res.json({ success: true, message: 'Media asset deleted successfully', data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
