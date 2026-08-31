import { Router } from 'express';
import { qrService } from '../../core/qr/qrService.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { auditAction } from '../middleware/auditMiddleware.js';

const router = Router();

// GET /api/v1/qr-codes (optionally filter by branchId)
router.get('/qr-codes', authenticate, async (req, res, next) => {
  try {
    const { branchId } = req.query;
    const qrCodes = branchId
      ? await qrService.listQRCodesByBranch(branchId)
      : await qrService.listAllQRCodes();
    res.json({ success: true, data: qrCodes });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/qr-codes/:id
router.get('/qr-codes/:id', authenticate, async (req, res, next) => {
  try {
    const qrCode = await qrService.getQRCode(req.params.id);
    res.json({ success: true, data: qrCode });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/qr-codes
router.post(
  '/qr-codes',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('QR_CREATE', 'QR_CODE', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      const qrCode = await qrService.generateQRCode(req.body);
      res.status(201).json({ success: true, data: qrCode });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/qr-codes/:id/status
router.patch(
  '/qr-codes/:id/status',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('QR_STATUS_CHANGE', 'QR_CODE', req => req.params.id),
  async (req, res, next) => {
    try {
      const qrCode = await qrService.setQRCodeStatus(req.params.id, req.body.status);
      res.json({ success: true, data: qrCode });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/qr-codes/:id/regenerate
router.post(
  '/qr-codes/:id/regenerate',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('QR_REGENERATE', 'QR_CODE', req => req.params.id),
  async (req, res, next) => {
    try {
      const qrCode = await qrService.regenerateQRCode(req.params.id);
      res.json({ success: true, data: qrCode });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/qr-codes/:id
router.delete(
  '/qr-codes/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('QR_DELETE', 'QR_CODE', req => req.params.id),
  async (req, res, next) => {
    try {
      const result = await qrService.deleteQRCode(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
