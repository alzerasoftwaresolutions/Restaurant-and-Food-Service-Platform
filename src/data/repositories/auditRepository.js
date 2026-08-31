import { queryOne, queryAll, execute } from '../db.js';

/**
 * Audit Logging — PostgreSQL Repository
 */
export const auditRepository = {
  async create(entry) {
    const sql = `
      INSERT INTO audit_logs (
        id, actor_user_id, actor_username, action, target_type,
        target_id, details, ip_address, result, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      entry.id,
      entry.actorUserId || null,
      entry.actorUsername,
      entry.action,
      entry.targetType,
      entry.targetId || null,
      entry.details || null,
      entry.ipAddress || null,
      entry.result || 'SUCCESS'
    ]);
  },

  async list(filters = {}) {
    const { targetType, action, actorUsername, limit = 50, offset = 0 } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (targetType) {
      conditions.push(`target_type = $${paramIndex++}`);
      params.push(targetType);
    }
    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }
    if (actorUsername) {
      conditions.push(`actor_username = $${paramIndex++}`);
      params.push(actorUsername);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const records = await queryAll(sql, params);

    // Total count for pagination
    const countSql = `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`;
    const countRes = await queryOne(countSql, params.slice(0, conditions.length));
    const total = Number(countRes?.total || 0);

    return { records, total };
  },

  async getRecent(limit = 10) {
    const sql = 'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1';
    return queryAll(sql, [limit]);
  }
};
