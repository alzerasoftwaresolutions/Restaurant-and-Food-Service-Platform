import { queryOne, queryAll, execute } from '../db.js';

/**
 * Organization Management — PostgreSQL Repository
 */
export const organizationRepository = {
  // --- Restaurants ---
  async findRestaurantById(id) {
    return queryOne('SELECT * FROM restaurants WHERE id = $1', [id]);
  },

  async findRestaurantBySlug(slug) {
    return queryOne('SELECT * FROM restaurants WHERE slug = $1', [slug]);
  },

  async listAllRestaurants() {
    return queryAll('SELECT * FROM restaurants ORDER BY name ASC');
  },

  async createRestaurant(rest) {
    const sql = `
      INSERT INTO restaurants (
        id, name, legal_name, slug, description, currency, phone, email, website,
        logo_media_id, banner_media_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      rest.id,
      rest.name,
      rest.legalName || null,
      rest.slug,
      rest.description || null,
      rest.currency || 'USD',
      rest.phone || null,
      rest.email || null,
      rest.website || null,
      rest.logoMediaId || null,
      rest.bannerMediaId || null,
      rest.status || 'Active'
    ]);
  },

  async updateRestaurant(id, updates) {
    const sql = `
      UPDATE restaurants
      SET name = COALESCE($1, name),
          legal_name = COALESCE($2, legal_name),
          slug = COALESCE($3, slug),
          description = COALESCE($4, description),
          currency = COALESCE($5, currency),
          phone = COALESCE($6, phone),
          email = COALESCE($7, email),
          website = COALESCE($8, website),
          logo_media_id = COALESCE($9, logo_media_id),
          banner_media_id = COALESCE($10, banner_media_id),
          status = COALESCE($11, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `;
    return queryOne(sql, [
      updates.name || null,
      updates.legalName || null,
      updates.slug || null,
      updates.description || null,
      updates.currency || null,
      updates.phone || null,
      updates.email || null,
      updates.website || null,
      updates.logoMediaId || null,
      updates.bannerMediaId || null,
      updates.status || null,
      id
    ]);
  },

  async setRestaurantStatus(id, status) {
    const sql = `
      UPDATE restaurants
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [status, id]);
  },

  // --- Branches ---
  async findBranchById(id) {
    return queryOne('SELECT * FROM branches WHERE id = $1', [id]);
  },

  async findBranchBySlug(slug) {
    return queryOne('SELECT * FROM branches WHERE slug = $1', [slug]);
  },

  async findBranchByCode(restaurantId, code) {
    return queryOne('SELECT * FROM branches WHERE restaurant_id = $1 AND code = $2', [restaurantId, code]);
  },

  async listBranchesByRestaurant(restaurantId) {
    const sql = `
      SELECT b.*, r.name AS restaurant_name
      FROM branches b
      JOIN restaurants r ON r.id = b.restaurant_id
      WHERE b.restaurant_id = $1
      ORDER BY b.name ASC
    `;
    return queryAll(sql, [restaurantId]);
  },

  async listAllBranches() {
    const sql = `
      SELECT b.*, r.name AS restaurant_name,
             (SELECT COUNT(*) FROM menu_branch_assignments mba WHERE mba.branch_id = b.id AND mba.is_active = 1) AS assigned_menu_count
      FROM branches b
      JOIN restaurants r ON r.id = b.restaurant_id
      ORDER BY b.name ASC
    `;
    return queryAll(sql);
  },

  async createBranch(branch) {
    const sql = `
      INSERT INTO branches (
        id, restaurant_id, name, code, slug, address_line1, address_line2,
        city, state, postal_code, country, phone, email, opening_hours,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      branch.id,
      branch.restaurantId,
      branch.name,
      branch.code,
      branch.slug,
      branch.addressLine1,
      branch.addressLine2 || null,
      branch.city,
      branch.state || null,
      branch.postalCode || null,
      branch.country || 'USA',
      branch.phone || null,
      branch.email || null,
      branch.openingHours || null,
      branch.status || 'Active'
    ]);
  },

  async updateBranch(id, updates) {
    const sql = `
      UPDATE branches
      SET name = COALESCE($1, name),
          code = COALESCE($2, code),
          slug = COALESCE($3, slug),
          address_line1 = COALESCE($4, address_line1),
          address_line2 = COALESCE($5, address_line2),
          city = COALESCE($6, city),
          state = COALESCE($7, state),
          postal_code = COALESCE($8, postal_code),
          country = COALESCE($9, country),
          phone = COALESCE($10, phone),
          email = COALESCE($11, email),
          opening_hours = COALESCE($12, opening_hours),
          status = COALESCE($13, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `;
    return queryOne(sql, [
      updates.name || null,
      updates.code || null,
      updates.slug || null,
      updates.addressLine1 || null,
      updates.addressLine2 || null,
      updates.city || null,
      updates.state || null,
      updates.postalCode || null,
      updates.country || null,
      updates.phone || null,
      updates.email || null,
      updates.openingHours || null,
      updates.status || null,
      id
    ]);
  },

  async setBranchStatus(id, status) {
    const sql = `
      UPDATE branches
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [status, id]);
  }
};
