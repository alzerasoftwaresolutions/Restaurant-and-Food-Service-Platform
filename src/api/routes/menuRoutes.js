import { Router } from 'express';
import { menuService } from '../../core/menu/menuService.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { auditAction } from '../middleware/auditMiddleware.js';

const router = Router();

// ==========================================
// Menu Endpoints
// ==========================================

// GET /api/v1/menus (optionally filter by restaurantId)
router.get('/menus', authenticate, async (req, res, next) => {
  try {
    const { restaurantId } = req.query;
    const menus = restaurantId
      ? await menuService.listMenusByRestaurant(restaurantId)
      : await menuService.listAllMenus();
    res.json({ success: true, data: menus });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/menus/:id
router.get('/menus/:id', authenticate, async (req, res, next) => {
  try {
    const menu = await menuService.getMenu(req.params.id);
    res.json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/menus
router.post(
  '/menus',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_CREATE', 'MENU', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      const menu = await menuService.createMenu(req.body);
      res.status(201).json({ success: true, data: menu });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/menus/:id
router.put(
  '/menus/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_UPDATE', 'MENU', req => req.params.id),
  async (req, res, next) => {
    try {
      const menu = await menuService.updateMenu(req.params.id, req.body);
      res.json({ success: true, data: menu });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/menus/:id/status
router.patch(
  '/menus/:id/status',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_STATUS_CHANGE', 'MENU', req => req.params.id),
  async (req, res, next) => {
    try {
      const menu = await menuService.setMenuStatus(req.params.id, req.body.status);
      res.json({ success: true, data: menu });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Category Endpoints
// ==========================================

// GET /api/v1/categories?menuId=...
router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const { menuId } = req.query;
    if (!menuId) {
      return res.status(400).json({ success: false, error: 'menuId query parameter is required' });
    }
    const categories = await menuService.listCategoriesByMenu(menuId);
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/categories
router.post(
  '/categories',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('CATEGORY_CREATE', 'CATEGORY', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      const category = await menuService.createCategory(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/categories/:id
router.put(
  '/categories/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('CATEGORY_UPDATE', 'CATEGORY', req => req.params.id),
  async (req, res, next) => {
    try {
      const category = await menuService.updateCategory(req.params.id, req.body);
      res.json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/categories/:id
router.delete(
  '/categories/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('CATEGORY_DELETE', 'CATEGORY', req => req.params.id),
  async (req, res, next) => {
    try {
      const result = await menuService.deleteCategory(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/categories/reorder
router.post(
  '/categories/reorder',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('CATEGORY_REORDER', 'CATEGORY'),
  async (req, res, next) => {
    try {
      const result = await menuService.reorderCategories(req.body.categoryOrders);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Menu Item Endpoints
// ==========================================

// GET /api/v1/menu-items?menuId=... OR categoryId=...
router.get('/menu-items', authenticate, async (req, res, next) => {
  try {
    const { menuId, categoryId } = req.query;
    let items = [];
    if (categoryId) {
      items = await menuService.listMenuItemsByCategory(categoryId);
    } else if (menuId) {
      items = await menuService.listMenuItemsByMenu(menuId);
    } else {
      return res.status(400).json({ success: false, error: 'menuId or categoryId query parameter is required' });
    }
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/menu-items/:id
router.get('/menu-items/:id', authenticate, async (req, res, next) => {
  try {
    const item = await menuService.getMenuItem(req.params.id);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/menu-items
router.post(
  '/menu-items',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_ITEM_CREATE', 'MENU_ITEM', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      const item = await menuService.createMenuItem(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/menu-items/:id
router.put(
  '/menu-items/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_ITEM_UPDATE', 'MENU_ITEM', req => req.params.id),
  async (req, res, next) => {
    try {
      const item = await menuService.updateMenuItem(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/menu-items/:id
router.delete(
  '/menu-items/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_ITEM_DELETE', 'MENU_ITEM', req => req.params.id),
  async (req, res, next) => {
    try {
      const result = await menuService.deleteMenuItem(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/menu-items/:id/availability (Instant toggle)
router.patch(
  '/menu-items/:id/availability',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_ITEM_AVAILABILITY_CHANGE', 'MENU_ITEM', req => req.params.id),
  async (req, res, next) => {
    try {
      const { isAvailable } = req.body;
      const item = await menuService.setItemAvailability(req.params.id, isAvailable);
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Menu-Branch Assignment Endpoints
// ==========================================

// GET /api/v1/menu-assignments
router.get('/menu-assignments', authenticate, async (req, res, next) => {
  try {
    const { branchId, menuId } = req.query;
    let assignments = [];
    if (branchId) {
      assignments = await menuService.listAssignmentsByBranch(branchId);
    } else if (menuId) {
      assignments = await menuService.listAssignmentsByMenu(menuId);
    } else {
      assignments = await menuService.listAllAssignments();
    }
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/menu-assignments
router.post(
  '/menu-assignments',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_ASSIGNMENT_CREATE', 'MENU_ASSIGNMENT'),
  async (req, res, next) => {
    try {
      const assignment = await menuService.assignMenuToBranch(req.body);
      res.status(201).json({ success: true, data: assignment });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/menu-assignments
router.delete(
  '/menu-assignments',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('MENU_ASSIGNMENT_DELETE', 'MENU_ASSIGNMENT'),
  async (req, res, next) => {
    try {
      const { menuId, branchId } = req.query;
      const result = await menuService.removeMenuFromBranch(menuId, branchId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
