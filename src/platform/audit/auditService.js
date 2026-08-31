import { randomUUID } from 'node:crypto';
import { auditRepository } from '../../data/repositories/auditRepository.js';

/**
 * Audit Logging — Platform Service
 */
export const auditService = {
  async logAction({
    actorUserId,
    actorUsername,
    action,
    targetType,
    targetId,
    details,
    result = 'SUCCESS',
    ipAddress
  }) {
    const id = `aud_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;

    return auditRepository.create({
      id,
      actorUserId,
      actorUsername: actorUsername || 'SYSTEM',
      action,
      targetType,
      targetId,
      details: detailsStr,
      result,
      ipAddress
    });
  },

  async listAuditLogs({ targetType, action, actorUsername, page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const { records, total } = await auditRepository.list({
      targetType,
      action,
      actorUsername,
      limit: limitNum,
      offset
    });

    return {
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  },

  async getRecentActivity(limit = 10) {
    return auditRepository.getRecent(limit);
  }
};
