import { auditService } from '../../platform/audit/auditService.js';

export function auditAction(actionName, targetTypeExtractor, targetIdExtractor) {
  return (req, res, next) => {
    // Intercept response finish to record result and status
    const originalJson = res.json;
    res.json = function (body) {
      res.json = originalJson;

      // Only audit on administrative endpoints
      if (req.user) {
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        const targetType = typeof targetTypeExtractor === 'function' ? targetTypeExtractor(req) : targetTypeExtractor;
        const targetId = typeof targetIdExtractor === 'function' ? targetIdExtractor(req, body) : (req.params.id || null);

        try {
          auditService.logAction({
            actorUserId: req.user.id,
            actorUsername: req.user.username,
            action: actionName,
            targetType: targetType || 'SYSTEM',
            targetId: targetId ? String(targetId) : null,
            details: {
              method: req.method,
              path: req.originalUrl,
              statusCode: res.statusCode,
              bodyParams: req.body ? Object.keys(req.body) : []
            },
            result: isSuccess ? 'SUCCESS' : 'FAILURE',
            ipAddress: req.ip || req.connection?.remoteAddress || ''
          });
        } catch (auditErr) {
          console.error('Failed to log audit event:', auditErr);
        }
      }

      return originalJson.call(this, body);
    };

    next();
  };
}
