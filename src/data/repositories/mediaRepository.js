import { queryOne, queryAll, execute } from '../db.js';

/**
 * Media Management — PostgreSQL Repository
 */
export const mediaRepository = {
  async findById(id) {
    return queryOne('SELECT * FROM media_assets WHERE id = $1', [id]);
  },

  async listAll() {
    return queryAll('SELECT * FROM media_assets ORDER BY created_at DESC');
  },

  async listByType(assetType) {
    return queryAll('SELECT * FROM media_assets WHERE asset_type = $1 ORDER BY created_at DESC', [assetType]);
  },

  async create(asset) {
    const sql = `
      INSERT INTO media_assets (
        id, original_filename, stored_filename, mime_type, file_size_bytes,
        file_path, asset_type, alt_text, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      asset.id,
      asset.originalFilename,
      asset.storedFilename,
      asset.mimeType,
      asset.fileSizeBytes,
      asset.filePath,
      asset.assetType || 'general',
      asset.altText || null
    ]);
  },

  async delete(id) {
    return execute('DELETE FROM media_assets WHERE id = $1', [id]);
  },

  async getAssetUsageCount(mediaId) {
    const restRes = await queryOne(
      'SELECT COUNT(*) AS count FROM restaurants WHERE logo_media_id = $1 OR banner_media_id = $1',
      [mediaId]
    );
    const itemRes = await queryOne(
      'SELECT COUNT(*) AS count FROM menu_items WHERE media_id = $1',
      [mediaId]
    );
    return Number(restRes?.count || 0) + Number(itemRes?.count || 0);
  }
};
