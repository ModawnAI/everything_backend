/**
 * User Profile Controller
 * 
 * Handles all user profile management endpoints including:
 * - Profile CRUD operations
 * - Profile image upload
 * - Privacy settings management
 * - Profile completion tracking
 * - Account deletion
 */

import { Request, Response, NextFunction } from 'express';
import { userProfileService, ProfileUpdateRequest, PrivacySettingsUpdateRequest } from '../services/user-profile.service';
import { logger } from '../utils/logger';
import { logProfileSecurityEvent } from '../middleware/profile-security.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Request interfaces
export interface GetProfileRequest extends AuthenticatedRequest {}

export interface UpdateProfileRequest extends AuthenticatedRequest {
  body: ProfileUpdateRequest;
}

export interface UpdateSettingsRequest extends AuthenticatedRequest {
  body: PrivacySettingsUpdateRequest;
}

export interface UploadImageRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

export interface DeleteAccountRequest extends AuthenticatedRequest {
  body: {
    reason?: string;
    password?: string; // For additional verification
  };
}

export interface AcceptTermsRequest extends AuthenticatedRequest {}

export interface AcceptPrivacyRequest extends AuthenticatedRequest {}

export class UserProfileController {
  /**
   * GET /api/users/profile
   * Get current user's profile
   */
  public getProfile = async (req: GetProfileRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const profile = await userProfileService.getUserProfile(userId);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: '사용자 프로필을 찾을 수 없습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          profile,
          message: '프로필 정보를 성공적으로 조회했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserProfileController.getProfile error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/users/profile
   * Update current user's profile
   */
  public updateProfile = async (req: UpdateProfileRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const updates = req.body;
      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '업데이트할 필드를 지정해주세요.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const updatedProfile = await userProfileService.updateUserProfile(userId, updates);

      // Log successful profile update
      await logProfileSecurityEvent(req, 'profile_update', true, {
        updatedFields: Object.keys(updates),
        profileId: updatedProfile.id
      });

      res.status(200).json({
        success: true,
        data: {
          profile: updatedProfile,
          message: '프로필이 성공적으로 업데이트되었습니다.'
        }
      });
    } catch (error) {
      // Log failed profile update
      await logProfileSecurityEvent(req, 'profile_update', false, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      logger.error('UserProfileController.updateProfile error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/users/settings
   * Get current user's privacy settings
   */
  public getSettings = async (req: GetProfileRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const settings = await userProfileService.getUserSettings(userId);

      res.status(200).json({
        success: true,
        data: {
          settings,
          message: '개인정보 설정을 성공적으로 조회했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserProfileController.getSettings error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/users/settings
   * Update current user's privacy settings
   */
  public updateSettings = async (req: UpdateSettingsRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const updates = req.body;
      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '업데이트할 설정을 지정해주세요.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const updatedSettings = await userProfileService.updateUserSettings(userId, updates);

      // Log successful settings update
      await logProfileSecurityEvent(req, 'settings_update', true, {
        updatedFields: Object.keys(updates),
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          settings: updatedSettings,
          message: '개인정보 설정이 성공적으로 업데이트되었습니다.'
        }
      });
    } catch (error) {
      // Log failed settings update
      await logProfileSecurityEvent(req, 'settings_update', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      logger.error('UserProfileController.updateSettings error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/users/profile/completion
   * Get profile completion status
   */
  public getProfileCompletion = async (req: GetProfileRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const completionStatus = await userProfileService.getProfileCompletionStatus(userId);

      res.status(200).json({
        success: true,
        data: {
          completion: completionStatus,
          message: '프로필 완성도 정보를 성공적으로 조회했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserProfileController.getProfileCompletion error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/users/profile/image
   * Upload profile image
   */
  public uploadProfileImage = async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_PROVIDED',
            message: '업로드할 이미지 파일을 선택해주세요.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const result = await userProfileService.uploadProfileImage(userId, file.buffer, file.originalname);

      if (!result.success) {
        // Log failed image upload
        await logProfileSecurityEvent(req, 'image_upload', false, {
          error: result.error || 'Upload failed',
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          userId
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: result.error || '이미지 업로드에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Log successful image upload
      await logProfileSecurityEvent(req, 'image_upload', true, {
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        imageUrl: result.imageUrl,
        thumbnailUrl: result.thumbnailUrl,
        originalSize: result.metadata?.originalSize,
        optimizedSize: result.metadata?.optimizedSize,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl,
          metadata: result.metadata,
          message: '프로필 이미지가 성공적으로 업로드되었습니다.'
        }
      });
    } catch (error) {
      // Log failed image upload
      await logProfileSecurityEvent(req, 'image_upload', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      logger.error('UserProfileController.uploadProfileImage error:', { error });
      next(error);
    }
  };

  /**
   * DELETE /api/users/account
   * Delete user account (soft delete)
   */
  public deleteAccount = async (req: DeleteAccountRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { reason } = req.body;

      await userProfileService.deleteUserAccount(userId, reason);

      // Log successful account deletion
      await logProfileSecurityEvent(req, 'account_deletion', true, {
        reason: reason || 'No reason provided',
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          message: '계정이 성공적으로 삭제되었습니다. 이용해주셔서 감사합니다.'
        }
      });
    } catch (error) {
      // Log failed account deletion
      await logProfileSecurityEvent(req, 'account_deletion', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      logger.error('UserProfileController.deleteAccount error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/users/terms/accept
   * Accept terms and conditions
   */
  public acceptTerms = async (req: AcceptTermsRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await userProfileService.acceptTerms(userId);

      res.status(200).json({
        success: true,
        data: {
          message: '이용약관에 동의했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserProfileController.acceptTerms error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/users/privacy/accept
   * Accept privacy policy
   */
  public acceptPrivacy = async (req: AcceptPrivacyRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await userProfileService.acceptPrivacy(userId);

      res.status(200).json({
        success: true,
        data: {
          message: '개인정보처리방침에 동의했습니다.'
        }
      });
    } catch (error) {
      logger.error('UserProfileController.acceptPrivacy error:', { error });
      next(error);
    }
  };
}

export const userProfileController = new UserProfileController(); 