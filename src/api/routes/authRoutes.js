import { Router } from 'express';
import { identityService } from '../../platform/identity/identityService.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { auditAction } from '../middleware/auditMiddleware.js';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, username, email, password } = req.body;
    const loginIdentifier = identifier || username || email;
    const authResult = await identityService.authenticate(loginIdentifier, password);

    res.json({
      success: true,
      data: authResult
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/profile
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const profile = await identityService.getUserProfile(userId);
    res.json({
      success: true,
      data: profile
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/password
router.post(
  '/password',
  authenticate,
  auditAction('USER_PASSWORD_CHANGE', 'USER', req => req.user.userId || req.user.id),
  async (req, res, next) => {
    try {
      const userId = req.user.userId || req.user.id;
      const { currentPassword, newPassword } = req.body;
      await identityService.changePassword(userId, currentPassword, newPassword);
      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
