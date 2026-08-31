import { queryOne, queryAll, execute, withTransaction } from '../db.js';

/**
 * Menu Management — PostgreSQL Repository
 */
export const menuRepository = {
  // --- Menus ---
  async findMenuById(id) {
    return queryOne('SELECT * FROM menus WHERE id = $1', [id]);
  },

  async listMenusByRestaurant(restaurantId) {
    const menus = await queryAll(`
      SELECT * FROM menus
      WHERE restaurant_id = $1
      ORDER BY name ASC
    `, [restaurantId]);

    for (const m of menus) {
      const catRes = await queryOne('SELECT COUNT(*) AS count FROM categories WHERE menu_id = $1', [m.id]);
      const itemRes = await queryOne(`
        SELECT COUNT(*) AS count FROM menu_items mi
        JOIN categories c ON c.id = mi.category_id
        WHERE c.menu_id = $1
      `, [m.id]);
      const asgnRes = await queryOne('SELECT COUNT(*) AS count FROM menu_branch_assignments WHERE menu_id = $1 AND is_active = 1', [m.id]);

      m.category_count = Number(catRes?.count || 0);
      m.item_count = Number(itemRes?.count || 0);
      m.assigned_branch_count = Number(asgnRes?.count || 0);
    }
    return menus;
  },

  async listAllMenus() {
    const menus = await queryAll(`
      SELECT m.*, r.name AS restaurant_name
      FROM menus m
      JOIN restaurants r ON r.id = m.restaurant_id
      ORDER BY m.name ASC
    `);

    for (const m of menus) {
      const catRes = await queryOne('SELECT COUNT(*) AS count FROM categories WHERE menu_id = $1', [m.id]);
      const itemRes = await queryOne(`
        SELECT COUNT(*) AS count FROM menu_items mi
        JOIN categories c ON c.id = mi.category_id
        WHERE c.menu_id = $1
      `, [m.id]);
      const asgnRes = await queryOne('SELECT COUNT(*) AS count FROM menu_branch_assignments WHERE menu_id = $1 AND is_active = 1', [m.id]);

      m.category_count = Number(catRes?.count || 0);
      m.item_count = Number(itemRes?.count || 0);
      m.assigned_branch_count = Number(asgnRes?.count || 0);
    }
    return menus;
  },

  async createMenu(menu) {
    const sql = `
      INSERT INTO menus (id, restaurant_id, name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      menu.id,
      menu.restaurantId,
      menu.name,
      menu.description || null,
      menu.status || 'Active'
    ]);
  },

  async updateMenu(id, updates) {
    const sql = `
      UPDATE menus
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    return queryOne(sql, [
      updates.name || null,
      updates.description || null,
      updates.status || null,
      id
    ]);
  },

  async setMenuStatus(id, status) {
    const sql = `
      UPDATE menus
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [status, id]);
  },

  // --- Categories ---
  async findCategoryById(id) {
    return queryOne('SELECT * FROM categories WHERE id = $1', [id]);
  },

  async listCategoriesByMenu(menuId) {
    const categories = await queryAll(`
      SELECT * FROM categories
      WHERE menu_id = $1
      ORDER BY display_order ASC, name ASC
    `, [menuId]);

    for (const c of categories) {
      const countRes = await queryOne('SELECT COUNT(*) AS count FROM menu_items WHERE category_id = $1', [c.id]);
      c.item_count = Number(countRes?.count || 0);
    }
    return categories;
  },

  async createCategory(cat) {
    const sql = `
      INSERT INTO categories (id, menu_id, name, description, display_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      cat.id,
      cat.menuId,
      cat.name,
      cat.description || null,
      cat.displayOrder || 0
    ]);
  },

  async updateCategory(id, updates) {
    const sql = `
      UPDATE categories
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          display_order = COALESCE($3, display_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    return queryOne(sql, [
      updates.name || null,
      updates.description || null,
      updates.displayOrder !== undefined ? updates.displayOrder : null,
      id
    ]);
  },

  async deleteCategory(id) {
    return execute('DELETE FROM categories WHERE id = $1', [id]);
  },

  async reorderCategories(categoryOrders) {
    return withTransaction(async (client) => {
      for (const item of categoryOrders) {
        await client.query(
          'UPDATE categories SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [item.displayOrder, item.id]
        );
      }
    });
  },

  // --- Menu Items ---
  async findMenuItemById(id) {
    const sql = `
      SELECT mi.*, c.name AS category_name, c.menu_id, m.file_path AS media_url
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      LEFT JOIN media_assets m ON m.id = mi.media_id
      WHERE mi.id = $1
    `;
    return queryOne(sql, [id]);
  },

  async listMenuItemsByCategory(categoryId) {
    const sql = `
      SELECT mi.*, m.file_path AS media_url
      FROM menu_items mi
      LEFT JOIN media_assets m ON m.id = mi.media_id
      WHERE mi.category_id = $1
      ORDER BY mi.display_order ASC, mi.name ASC
    `;
    return queryAll(sql, [categoryId]);
  },

  async listMenuItemsByMenu(menuId) {
    const sql = `
      SELECT mi.*, c.name AS category_name, m.file_path AS media_url
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      LEFT JOIN media_assets m ON m.id = mi.media_id
      WHERE c.menu_id = $1
      ORDER BY c.display_order ASC, mi.display_order ASC, mi.name ASC
    `;
    return queryAll(sql, [menuId]);
  },

  async createMenuItem(item) {
    const sql = `
      INSERT INTO menu_items (
        id, category_id, name, description, price, currency,
        dietary_flags, allergens, media_id, is_available, display_order,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return queryOne(sql, [
      item.id,
      item.categoryId,
      item.name,
      item.description || null,
      item.price,
      item.currency || 'USD',
      item.dietaryFlags || null,
      item.allergens || null,
      item.mediaId || null,
      item.isAvailable !== undefined ? (item.isAvailable ? 1 : 0) : 1,
      item.displayOrder || 0
    ]);
  },

  async updateMenuItem(id, updates) {
    const sql = `
      UPDATE menu_items
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          price = COALESCE($3, price),
          currency = COALESCE($4, currency),
          dietary_flags = COALESCE($5, dietary_flags),
          allergens = COALESCE($6, allergens),
          media_id = COALESCE($7, media_id),
          is_available = COALESCE($8, is_available),
          display_order = COALESCE($9, display_order),
          category_id = COALESCE($10, category_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `;
    return queryOne(sql, [
      updates.name || null,
      updates.description || null,
      updates.price !== undefined ? updates.price : null,
      updates.currency || null,
      updates.dietaryFlags !== undefined ? updates.dietaryFlags : null,
      updates.allergens !== undefined ? updates.allergens : null,
      updates.mediaId !== undefined ? updates.mediaId : null,
      updates.isAvailable !== undefined ? (updates.isAvailable ? 1 : 0) : null,
      updates.displayOrder !== undefined ? updates.displayOrder : null,
      updates.categoryId || null,
      id
    ]);
  },

  async deleteMenuItem(id) {
    return execute('DELETE FROM menu_items WHERE id = $1', [id]);
  },

  async setItemAvailability(id, isAvailable) {
    const sql = `
      UPDATE menu_items
      SET is_available = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    return queryOne(sql, [isAvailable ? 1 : 0, id]);
  },

  // --- Assignments ---
  async findAssignment(menuId, branchId) {
    const sql = 'SELECT * FROM menu_branch_assignments WHERE menu_id = $1 AND branch_id = $2';
    return queryOne(sql, [menuId, branchId]);
  },

  async listAssignmentsByBranch(branchId) {
    const sql = `
      SELECT mba.*, m.name AS menu_name, m.status AS menu_status
      FROM menu_branch_assignments mba
      JOIN menus m ON m.id = mba.menu_id
      WHERE mba.branch_id = $1
    `;
    return queryAll(sql, [branchId]);
  },

  async listAssignmentsByMenu(menuId) {
    const sql = `
      SELECT mba.*, b.name AS branch_name, b.code AS branch_code, b.status AS branch_status
      FROM menu_branch_assignments mba
      JOIN branches b ON b.id = mba.branch_id
      WHERE mba.menu_id = $1
    `;
    return queryAll(sql, [menuId]);
  },

  async listAllAssignments() {
    const sql = `
      SELECT mba.*, m.name AS menu_name, b.name AS branch_name, b.code AS branch_code
      FROM menu_branch_assignments mba
      JOIN menus m ON m.id = mba.menu_id
      JOIN branches b ON b.id = mba.branch_id
    `;
    return queryAll(sql);
  },

  async createAssignment(assignment) {
    const sql = `
      INSERT INTO menu_branch_assignments (id, menu_id, branch_id, is_active, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (menu_id, branch_id) DO UPDATE SET is_active = EXCLUDED.is_active
      RETURNING *
    `;
    return queryOne(sql, [
      assignment.id,
      assignment.menuId,
      assignment.branchId,
      assignment.isActive !== undefined ? assignment.isActive : 1
    ]);
  },

  async deleteAssignment(menuId, branchId) {
    return execute('DELETE FROM menu_branch_assignments WHERE menu_id = $1 AND branch_id = $2', [menuId, branchId]);
  },

  // --- Authoritative Customer Public Menu Resolver ---
  async getPublishedBranchMenu(branchSlug) {
    // 1. Fetch branch and parent restaurant metadata
    const branchSql = `
      SELECT b.id AS branch_id, b.name AS branch_name, b.code AS branch_code, b.slug AS branch_slug,
             b.address_line1, b.address_line2, b.city, b.state, b.country, b.phone AS branch_phone,
             b.email AS branch_email, b.opening_hours, b.status AS branch_status,
             r.id AS restaurant_id, r.name AS restaurant_name, r.legal_name, r.slug AS restaurant_slug,
             r.description AS restaurant_description, r.currency, r.phone AS restaurant_phone,
             r.email AS restaurant_email, r.website AS restaurant_website, r.status AS restaurant_status,
             lm.file_path AS restaurant_logo_url, bm.file_path AS restaurant_banner_url
      FROM branches b
      JOIN restaurants r ON r.id = b.restaurant_id
      LEFT JOIN media_assets lm ON lm.id = r.logo_media_id
      LEFT JOIN media_assets bm ON bm.id = r.banner_media_id
      WHERE b.slug = $1
    `;
    const branch = await queryOne(branchSql, [branchSlug]);
    if (!branch) {
      return { found: false, reason: 'BRANCH_NOT_FOUND' };
    }

    if (branch.restaurant_status !== 'Active') {
      return {
        found: true,
        isPublished: false,
        reason: 'RESTAURANT_INACTIVE',
        branch: { name: branch.branch_name, restaurantName: branch.restaurant_name }
      };
    }

    if (branch.status !== 'Active' && branch.branch_status !== 'Active') {
      return {
        found: true,
        isPublished: false,
        reason: 'BRANCH_INACTIVE',
        branch: { name: branch.branch_name, restaurantName: branch.restaurant_name }
      };
    }

    // 2. Fetch Active Assigned Menus
    const menusSql = `
      SELECT m.id, m.name, m.description
      FROM menus m
      JOIN menu_branch_assignments mba ON mba.menu_id = m.id
      WHERE mba.branch_id = $1 AND mba.is_active = 1 AND m.status = 'Active'
      ORDER BY m.name ASC
    `;
    const menus = await queryAll(menusSql, [branch.branch_id]);

    // 3. For each active menu, fetch its categories and available items
    const menusData = [];
    for (const menu of menus) {
      const categoriesSql = `
        SELECT c.id, c.name, c.description, c.display_order
        FROM categories c
        WHERE c.menu_id = $1
        ORDER BY c.display_order ASC, c.name ASC
      `;
      const categories = await queryAll(categoriesSql, [menu.id]);

      const categoriesData = [];
      for (const cat of categories) {
        // Enforce availability: Only is_available = 1 items are shown to customers
        const itemsSql = `
          SELECT mi.id, mi.name, mi.description, mi.price, mi.currency,
                 mi.dietary_flags, mi.allergens, mi.display_order,
                 m.file_path AS media_url
          FROM menu_items mi
          LEFT JOIN media_assets m ON m.id = mi.media_id
          WHERE mi.category_id = $1 AND mi.is_available = 1
          ORDER BY mi.display_order ASC, mi.name ASC
        `;
        const items = await queryAll(itemsSql, [cat.id]);
        categoriesData.push({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          displayOrder: cat.display_order,
          items
        });
      }

      menusData.push({
        id: menu.id,
        name: menu.name,
        description: menu.description,
        categories: categoriesData
      });
    }

    return {
      found: true,
      isPublished: true,
      branch: {
        id: branch.branch_id,
        name: branch.branch_name,
        code: branch.branch_code,
        slug: branch.branch_slug,
        address: `${branch.address_line1}${branch.city ? ', ' + branch.city : ''}`,
        phone: branch.branch_phone || branch.restaurant_phone,
        email: branch.branch_email || branch.restaurant_email,
        openingHours: branch.opening_hours,
        currency: branch.currency,
        restaurantName: branch.restaurant_name,
        restaurantDescription: branch.restaurant_description,
        restaurantLogoUrl: branch.restaurant_logo_url,
        restaurantBannerUrl: branch.restaurant_banner_url
      },
      menus: menusData
    };
  }
};
