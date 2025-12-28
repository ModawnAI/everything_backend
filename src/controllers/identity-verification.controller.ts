/**
 * Identity Verification Controller
 *
 * Handles PortOne V2 identity verification (본인인증) requests
 */

import { Request, Response, NextFunction } from 'express';
import { portoneIdentityVerificationService } from '../services/portone-identity-verification.service';
import { logger } from '../utils/logger';

export class IdentityVerificationController {
  /**
   * POST /api/identity-verification/prepare
   * Prepare identity verification request
   */
  async prepareVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identityVerificationId, customer, bypass, customData } = req.body;
      const userId = (req as any).user?.id;

      // Validate required fields
      if (!identityVerificationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IDENTITY_VERIFICATION_ID',
            message: 'identityVerificationId는 필수입니다.'
          }
        });
        return;
      }

      logger.info('Preparing identity verification', {
        identityVerificationId,
        userId,
        hasCustomer: !!customer,
        hasBypass: !!bypass
      });

      // Prepare verification
      const result = await portoneIdentityVerificationService.prepareVerification({
        identityVerificationId,
        userId,
        customer,
        bypass,
        customData: customData ? JSON.stringify(customData) : undefined
      });

      res.status(200).json({
        success: true,
        data: result,
        message: '본인인증 준비가 완료되었습니다.'
      });

    } catch (error) {
      logger.error('Failed to prepare identity verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      next(error);
    }
  }

  /**
   * POST /api/identity-verification/verify
   * Verify identity verification result
   */
  async verifyIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identityVerificationId } = req.body;
      const userId = (req as any).user?.id;

      // Validate required fields
      if (!identityVerificationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IDENTITY_VERIFICATION_ID',
            message: 'identityVerificationId는 필수입니다.'
          }
        });
        return;
      }

      logger.info('Verifying identity', {
        identityVerificationId,
        userId
      });

      // Verify identity (pass userId for user verification update)
      const result = await portoneIdentityVerificationService.verifyIdentity(identityVerificationId, userId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: result.error || '본인인증에 실패했습니다.',
            details: { status: result.status }
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          identityVerificationId: result.identityVerificationId,
          status: result.status,
          verifiedCustomer: result.verifiedCustomer
        },
        message: '본인인증이 완료되었습니다.'
      });

    } catch (error) {
      logger.error('Failed to verify identity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      next(error);
    }
  }

  /**
   * GET /api/identity-verification/status/:identityVerificationId
   * Get verification status
   */
  async getVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identityVerificationId } = req.params;

      logger.info('Getting verification status', {
        identityVerificationId
      });

      const status = await portoneIdentityVerificationService.getVerificationStatus(identityVerificationId);

      if (!status.exists) {
        res.status(404).json({
          success: false,
          error: {
            code: 'VERIFICATION_NOT_FOUND',
            message: '본인인증 요청을 찾을 수 없습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      logger.error('Failed to get verification status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      next(error);
    }
  }

  /**
   * POST /api/identity-verification/danal/bypass-params
   * Helper endpoint to build Danal bypass parameters
   */
  async buildDanalBypassParams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { IsCarrier, AGELIMIT, CPTITLE } = req.body;

      const bypass = portoneIdentityVerificationService.buildDanalBypass({
        IsCarrier,
        AGELIMIT,
        CPTITLE
      });

      res.status(200).json({
        success: true,
        data: { bypass },
        message: 'Danal bypass 파라미터가 생성되었습니다.'
      });

    } catch (error) {
      logger.error('Failed to build Danal bypass params', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  }
}

// Export singleton instance
export const identityVerificationController = new IdentityVerificationController();
