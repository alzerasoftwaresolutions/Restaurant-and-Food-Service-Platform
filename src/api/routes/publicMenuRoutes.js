import { Router } from 'express';
import { menuRepository } from '../../data/repositories/menuRepository.js';
import { qrService } from '../../core/qr/qrService.js';

const router = Router();

// GET /api/v1/public/menu/:branchSlug
router.get('/menu/:branchSlug', async (req, res, next) => {
  try {
    const { branchSlug } = req.params;
    const result = await menuRepository.getPublishedBranchMenu(branchSlug);

    if (!result.found) {
      return res.status(404).json({
        success: false,
        isPublished: false,
        error: 'Branch location not found',
        reason: result.reason
      });
    }

    if (!result.isPublished) {
      let message = 'This menu is currently not available.';
      if (result.reason === 'BRANCH_INACTIVE') {
        message = 'This branch location is temporarily inactive.';
      } else if (result.reason === 'RESTAURANT_INACTIVE') {
        message = 'This restaurant is temporarily inactive.';
      }

      return res.status(200).json({
        success: true,
        isPublished: false,
        reason: result.reason,
        message,
        branch: result.branch
      });
    }

    res.json({
      success: true,
      isPublished: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/public/qr/resolve/:code
router.get('/qr/resolve/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const result = await qrService.resolveQRDestination(code);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        reason: result.reason,
        error: result.message
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
