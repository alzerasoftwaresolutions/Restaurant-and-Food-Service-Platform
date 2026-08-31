import { queryOne, execute, queryAll } from '../../data/db.js';

/**
 * Configuration — Platform Service
 */
export const configurationService = {
  async get(key, defaultValue = null) {
    const row = await queryOne('SELECT value FROM configuration WHERE key = $1', [key]);
    return row ? row.value : defaultValue;
  },

  async set(key, value, description = null) {
    const sql = `
      INSERT INTO configuration (key, value, description, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP
    `;
    await execute(sql, [key, String(value), description]);
    return { key, value };
  },

  async getAll() {
    const rows = await queryAll('SELECT key, value, description, updated_at FROM configuration ORDER BY key ASC');
    const result = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }
};
