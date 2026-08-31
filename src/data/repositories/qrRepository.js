import { queryOne, queryAll, execute } from '../db.js';

/**
 * QR Publishing — PostgreSQL Repository
 */
export const qrRepository = {
  async findById(id) {
    const sql = `
      SELECT q.*, b.name AS branch_name, b.code AS branch_code, b.slug AS branch_slug, b.status AS branch_status
      FROM qr_codes q
      JOIN branches b ON b.id = q.branch_id
      WHERE q.id = $1
    `;
    return queryOne(sql, [id]);
  },

  async findByCode(code) {
    const sql = `
      SELECT q.*, b.name AS branch_name, b.code AS branch_code, b.slug AS branch_slug, b.status AS branch_status
      FROM qr_codes q
      JOIN branches b ON b.id = q.branch_id
      WHERE q.code = $1
    `;
    return queryOne(sql, [code]);
  },

  async listByBranch(branchId) {
    const sql = `
      SELECT q.*, b.name AS branch_name, b.code AS branch_code, b.slug AS branch_slug, b.status AS branch_status
      FROM qr_codes q
      JOIN branches b ON b.id = q.branch_id
      WHERE q.branch_id = $1
      ORDER BY q.created_at DESC
    `;
    return queryAll(sql, [branchId]);
  },

  async listAll() {
    const sql = `
      SELECT q.*, b.name AS branch_name, b.code AS branch_code, b.slug AS branch_slug, b.status AS branch_status
      FROM qr_codes q
      JOIN branches b ON b.id = q.branch_id
      ORDER BY q.created_at DESC
    `;
    return queryAll(sql);
  },

  async create(qr) {
    const sql = `
      INSERT INTO qr_codes (id, branch_id, code, title, destination_url, qr_image_data, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      qr.id,
      qr.branchId,
      qr.code,
      qr.title,
      qr.destinationUrl,
      qr.qrImageData,
      qr.status || 'Active'
    ]);
  },

  async updateStatus(id, status) {
    const sql = `
      UPDATE qr_codes
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [status, id]);
  },

  async updateImageData(id, qrImageData) {
    const sql = `
      UPDATE qr_codes
      SET qr_image_data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [qrImageData, id]);
  },

  async delete(id) {
    return execute('DELETE FROM qr_codes WHERE id = $1', [id]);
  }
};
