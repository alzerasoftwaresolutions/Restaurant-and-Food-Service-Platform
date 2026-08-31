import { Router } from 'express';
import { organizationService } from '../../core/organization/organizationService.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { auditAction } from '../middleware/auditMiddleware.js';

const router = Router();

// ==========================================
// Restaurant Endpoints
// ==========================================

// GET /api/v1/restaurants
router.get('/restaurants', authenticate, async (req, res, next) => {
  try {
    const restaurants = await organizationService.listRestaurants();
    res.json({ success: true, data: restaurants });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/restaurants/:id
router.get('/restaurants/:id', authenticate, async (req, res, next) => {
  try {
    const restaurant = await organizationService.getRestaurant(req.params.id);
    res.json({ success: true, data: restaurant });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/restaurants
router.post(
  '/restaurants',
  authenticate,
  requireRole('admin'),
  auditAction('RESTAURANT_CREATE', 'RESTAURANT', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      const restaurant = await organizationService.createRestaurant(req.body);
      res.status(201).json({ success: true, data: restaurant });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/restaurants/:id
router.put(
  '/restaurants/:id',
  authenticate,
  requireRole('admin'),
  auditAction('RESTAURANT_UPDATE', 'RESTAURANT', req => req.params.id),
  async (req, res, next) => {
    try {
      const restaurant = await organizationService.updateRestaurant(req.params.id, req.body);
      res.json({ success: true, data: restaurant });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/restaurants/:id/status
router.patch(
  '/restaurants/:id/status',
  authenticate,
  requireRole('admin'),
  auditAction('RESTAURANT_STATUS_CHANGE', 'RESTAURANT', req => req.params.id),
  async (req, res, next) => {
    try {
      const restaurant = await organizationService.setRestaurantStatus(req.params.id, req.body.status);
      res.json({ success: true, data: restaurant });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Branch Endpoints
// ==========================================

// GET /api/v1/branches (optionally filter by restaurantId)
router.get('/branches', authenticate, async (req, res, next) => {
  try {
    const { restaurantId } = req.query;
    const branches = restaurantId
      ? await organizationService.listBranchesByRestaurant(restaurantId)
      : await organizationService.listAllBranches();
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/branches/:id
router.get('/branches/:id', authenticate, async (req, res, next) => {
  try {
    const branch = await organizationService.getBranch(req.params.id);
    res.json({ success: true, data: branch });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/branches
router.post(
  '/branches',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('BRANCH_CREATE', 'BRANCH', (_req, body) => body.data?.id),
  async (req, res, next) => {
    try {
      const branch = await organizationService.createBranch(req.body);
      res.status(201).json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/branches/:id
router.put(
  '/branches/:id',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('BRANCH_UPDATE', 'BRANCH', req => req.params.id),
  async (req, res, next) => {
    try {
      const branch = await organizationService.updateBranch(req.params.id, req.body);
      res.json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/branches/:id/status
router.patch(
  '/branches/:id/status',
  authenticate,
  requireRole('admin', 'manager'),
  auditAction('BRANCH_STATUS_CHANGE', 'BRANCH', req => req.params.id),
  async (req, res, next) => {
    try {
      const branch = await organizationService.setBranchStatus(req.params.id, req.body.status);
      res.json({ success: true, data: branch });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
