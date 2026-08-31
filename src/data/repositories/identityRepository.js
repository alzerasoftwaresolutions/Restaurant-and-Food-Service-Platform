import { queryOne, queryAll, execute, withTransaction } from '../db.js';

/**
 * Identity & Access — PostgreSQL Repository
 */
export const identityRepository = {
  async findById(id) {
    return queryOne('SELECT * FROM users WHERE id = $1', [id]);
  },

  async findByUsername(username) {
    return queryOne('SELECT * FROM users WHERE username = $1', [username]);
  },

  async findByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email = $1', [email]);
  },

  async findByIdentifier(identifier) {
    return queryOne('SELECT * FROM users WHERE username = $1 OR email = $2', [identifier, identifier]);
  },

  async create(user) {
    const sql = `
      INSERT INTO users (id, username, email, password_hash, full_name, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      user.id,
      user.username,
      user.email,
      user.passwordHash,
      user.fullName || null,
      user.isActive !== undefined ? user.isActive : 1
    ]);
  },

  async updatePassword(userId, passwordHash) {
    const sql = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [passwordHash, userId]);
  },

  async getUserRoles(userId) {
    const sql = `
      SELECT r.id, r.name, r.description
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `;
    return queryAll(sql, [userId]);
  },

  async assignRole(userId, roleId) {
    const sql = `
      INSERT INTO user_roles (user_id, role_id, assigned_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, role_id) DO NOTHING
    `;
    return execute(sql, [userId, roleId]);
  },

  async findRoleByName(roleName) {
    return queryOne('SELECT * FROM roles WHERE name = $1', [roleName]);
  },

  async createRole(role) {
    const sql = `
      INSERT INTO roles (id, name, description, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING *
    `;
    return queryOne(sql, [role.id, role.name, role.description || null]);
  }
};
