import { Request, Response } from 'express';
import { adminPointPolicyService } from '../services/admin-point-policy.service';
import { logger } from '../utils/logger';

export class AdminPointPolicyController {
  /**
   * GET /api/admin/points/policy
   * Get current active point policy
   */
  async getActivePolicy(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await adminPointPolicyService.getActivePolicy(user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get active point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get active point policy'
      });
    }
  }

  /**
   * GET /api/admin/points/policy/history
   * Get point policy history
   */
  async getPolicyHistory(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { page = '1', limit = '20' } = req.query;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await adminPointPolicyService.getPolicyHistory(
        parseInt(page as string, 10),
        parseInt(limit as string, 10),
        user.id
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get point policy history failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get point policy history'
      });
    }
  }

  /**
   * POST /api/admin/points/policy
   * Create new point policy
   */
  async createPolicy(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const {
        earningRatePercent,
        earningCapAmount,
        usageAvailabilityDelayDays,
        minimumUsageAmount,
        maximumUsagePercent,
        pointsExpiryDays,
        influencerReferralMultiplier,
        influencerBonusRatePercent,
        referralSignupBonus,
        referralFirstPurchaseBonus,
        effectiveFrom
      } = req.body;

      // Validate required fields
      if (
        earningRatePercent === undefined ||
        earningCapAmount === undefined ||
        usageAvailabilityDelayDays === undefined
      ) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
        return;
      }

      const result = await adminPointPolicyService.createPolicy(
        {
          earningRatePercent,
          earningCapAmount,
          usageAvailabilityDelayDays,
          minimumUsageAmount,
          maximumUsagePercent,
          pointsExpiryDays,
          influencerReferralMultiplier,
          influencerBonusRatePercent,
          referralSignupBonus,
          referralFirstPurchaseBonus,
          effectiveFrom
        },
        user.id
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Create point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create point policy'
      });
    }
  }

  /**
   * PUT /api/admin/points/policy/:id
   * Update point policy
   */
  async updatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Policy ID is required'
        });
        return;
      }

      const result = await adminPointPolicyService.updatePolicy(id, req.body, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Update point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        policyId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update point policy'
      });
    }
  }

  /**
   * DELETE /api/admin/points/policy/:id
   * Deactivate point policy
   */
  async deactivatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Policy ID is required'
        });
        return;
      }

      const result = await adminPointPolicyService.deactivatePolicy(id, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Deactivate point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        policyId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to deactivate point policy'
      });
    }
  }
}

export const adminPointPolicyController = new AdminPointPolicyController();
