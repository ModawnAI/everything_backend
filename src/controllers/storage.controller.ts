/**
 * Storage Controller
 * 
 * Handles storage-related API endpoints including:
 * - File upload and management
 * - Storage cleanup operations
 * - Storage statistics and monitoring
 */

import { Request, Response } from 'express';
import { storageService } from '../services/storage.service';
import { logger } from '../utils/logger';

// Request interfaces
interface StorageRequest extends Request {
  user?: {
    id: string;
    user_role: string;
  };
}

interface FileUploadRequest extends StorageRequest {
  body: {
    bucketId: string;
    filePath?: string;
    optimizeImage?: boolean;
    imageOptions?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    };
  };
  file?: Express.Multer.File;
}

interface StorageCleanupRequest extends StorageRequest {
  body: {
    dryRun?: boolean;
  };
}

export class StorageController {
  /**
   * POST /api/storage/upload
   * Upload file to storage
   */
  async uploadFile(req: FileUploadRequest, res: Response): Promise<void> {
    try {
      const { bucketId, filePath, optimizeImage, imageOptions } = req.body;
      const file = req.file;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          error: {
            code: 'NO_FILE_PROVIDED',
            message: '업로드할 파일을 선택해주세요.',
            details: '파일이 첨부되지 않았습니다.'
          }
        });
        return;
      }

      if (!bucketId) {
        res.status(400).json({
          error: {
            code: 'INVALID_BUCKET',
            message: '유효하지 않은 저장소입니다.',
            details: 'bucketId가 필요합니다.'
          }
        });
        return;
      }

      // Generate file path if not provided
      const finalFilePath = filePath || `${userId}/${Date.now()}-${file.originalname}`;

      // Upload file
      const uploadOptions: any = {
        contentType: file.mimetype
      };

      if (optimizeImage !== undefined) {
        uploadOptions.optimizeImage = optimizeImage;
      }

      if (imageOptions) {
        uploadOptions.imageOptions = imageOptions;
      }

      const result = await storageService.uploadFile(
        bucketId,
        finalFilePath,
        file.buffer,
        uploadOptions
      );

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'UPLOAD_FAILED',
            message: '파일 업로드에 실패했습니다.',
            details: result.error
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          fileUrl: result.fileUrl,
          filePath: result.filePath,
          metadata: result.metadata
        }
      });

    } catch (error) {
      logger.error('StorageController.uploadFile error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * DELETE /api/storage/files/:bucketId/:filePath
   * Delete file from storage
   */
  async deleteFile(req: StorageRequest, res: Response): Promise<void> {
    try {
      const { bucketId, filePath } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!bucketId || !filePath) {
        res.status(400).json({
          error: {
            code: 'INVALID_PARAMETERS',
            message: '유효하지 않은 매개변수입니다.',
            details: 'bucketId와 filePath가 필요합니다.'
          }
        });
        return;
      }

      // Delete file
      const result = await storageService.deleteFile(bucketId, filePath);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'DELETE_FAILED',
            message: '파일 삭제에 실패했습니다.',
            details: result.error
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          deletedFiles: result.deletedFiles
        }
      });

    } catch (error) {
      logger.error('StorageController.deleteFile error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/storage/files/:bucketId
   * List files in bucket
   */
  async listFiles(req: StorageRequest, res: Response): Promise<void> {
    try {
      const { bucketId } = req.params;
      const { path, limit, offset, search } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!bucketId) {
        res.status(400).json({
          error: {
            code: 'INVALID_BUCKET',
            message: '유효하지 않은 저장소입니다.',
            details: 'bucketId가 필요합니다.'
          }
        });
        return;
      }

      // List files
      const listOptions: any = {};

      if (path) {
        listOptions.path = path as string;
      }

      if (limit) {
        listOptions.limit = parseInt(limit as string);
      }

      if (offset) {
        listOptions.offset = parseInt(offset as string);
      }

      if (search) {
        listOptions.search = search as string;
      }

      const result = await storageService.listFiles(bucketId, listOptions);

      if (result.error) {
        res.status(400).json({
          error: {
            code: 'LIST_FAILED',
            message: '파일 목록 조회에 실패했습니다.',
            details: result.error
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          files: result.files
        }
      });

    } catch (error) {
      logger.error('StorageController.listFiles error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/storage/cleanup
   * Clean up orphaned files
   */
  async cleanupOrphanedFiles(req: StorageCleanupRequest, res: Response): Promise<void> {
    try {
      const { dryRun = false } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.user_role;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Only admins can perform cleanup
      if (userRole !== 'admin') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: '권한이 없습니다.',
            details: '관리자만 정리 작업을 수행할 수 있습니다.'
          }
        });
        return;
      }

      // Perform cleanup
      const result = await storageService.cleanupOrphanedFiles();

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'CLEANUP_FAILED',
            message: '정리 작업에 실패했습니다.',
            details: result.error
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          orphanedFiles: result.orphanedFiles,
          deletedFiles: dryRun ? [] : result.deletedFiles,
          dryRun
        }
      });

    } catch (error) {
      logger.error('StorageController.cleanupOrphanedFiles error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/storage/stats
   * Get storage statistics
   */
  async getStorageStats(req: StorageRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.user_role;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Only admins can view storage stats
      if (userRole !== 'admin') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: '권한이 없습니다.',
            details: '관리자만 저장소 통계를 볼 수 있습니다.'
          }
        });
        return;
      }

      // Get storage stats
      const stats = await storageService.getStorageStats();

      res.status(200).json({
        success: true,
        data: {
          totalFiles: stats.totalFiles,
          totalSize: stats.totalSize,
          bucketStats: stats.bucketStats
        }
      });

    } catch (error) {
      logger.error('StorageController.getStorageStats error:', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/storage/initialize
   * Initialize storage buckets and policies
   */
  async initializeStorage(req: StorageRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.user_role;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Only admins can initialize storage
      if (userRole !== 'admin') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: '권한이 없습니다.',
            details: '관리자만 저장소를 초기화할 수 있습니다.'
          }
        });
        return;
      }

      // Initialize storage
      await storageService.initializeStorage();

      res.status(200).json({
        success: true,
        message: '저장소가 성공적으로 초기화되었습니다.'
      });

    } catch (error) {
      logger.error('StorageController.initializeStorage error:', { error });
      res.status(500).json({
        error: {
          code: 'INITIALIZATION_FAILED',
          message: '저장소 초기화에 실패했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }
}

export const storageController = new StorageController(); 