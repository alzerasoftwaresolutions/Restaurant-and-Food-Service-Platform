import { Router } from 'express';
import { auditService } from '../../platform/audit/auditService.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/v1/audit-logs
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { targetType, targetId, actorUsername, page = 1, limit = 50 } = req.query;
    const result = await auditService.listAuditLogs({
      targetType,
      targetId,
      actorUsername,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50
    });

    res.json({
      success: true,
      data: result.records,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
});

export default router;
