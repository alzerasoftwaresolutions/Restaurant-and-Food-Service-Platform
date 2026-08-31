import { Router } from 'express';
import { queryOne, queryAll } from '../../data/db.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/v1/dashboard/overview
router.get('/overview', authenticate, async (req, res, next) => {
  try {
    const restaurantRes = await queryOne('SELECT COUNT(*) AS count FROM restaurants');
    const restaurantCount = Number(restaurantRes?.count || 0);

    const branchStats = await queryOne(`
      SELECT COUNT(*) AS total, 
             SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active
      FROM branches
    `) || { total: 0, active: 0 };

    const menuStats = await queryOne(`
      SELECT COUNT(*) AS total, 
             SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN status = 'Archived' THEN 1 ELSE 0 END) AS archived
      FROM menus
    `) || { total: 0, active: 0, archived: 0 };

    const categoryRes = await queryOne('SELECT COUNT(*) AS count FROM categories');
    const categoryCount = Number(categoryRes?.count || 0);

    const itemStats = await queryOne(`
      SELECT COUNT(*) AS total, 
             SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) AS available
      FROM menu_items
    `) || { total: 0, available: 0 };

    const qrStats = await queryOne(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active
      FROM qr_codes
    `) || { total: 0, active: 0 };

    const mediaRes = await queryOne('SELECT COUNT(*) AS count FROM media_assets');
    const mediaCount = Number(mediaRes?.count || 0);

    const recentActivity = await queryAll(`
      SELECT * FROM audit_logs 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        metrics: {
          restaurants: restaurantCount,
          branchesTotal: Number(branchStats.total || 0),
          branchesActive: Number(branchStats.active || 0),
          menusTotal: Number(menuStats.total || 0),
          menusActive: Number(menuStats.active || 0),
          categoriesTotal: categoryCount,
          itemsTotal: Number(itemStats.total || 0),
          itemsAvailable: Number(itemStats.available || 0),
          qrCodesTotal: Number(qrStats.total || 0),
          qrCodesActive: Number(qrStats.active || 0),
          mediaAssetsTotal: mediaCount
        },
        recentActivity
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
