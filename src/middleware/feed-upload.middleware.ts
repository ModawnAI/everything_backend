/**
 * Feed Upload Middleware
 *
 * Standardized multer configuration for feed image uploads
 * Used by both /api/feed and /api/user/feed routes
 */

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Shared multer configuration for feed uploads
 */
export const feedUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB per file
    files: 10,                     // Max 10 files
    fields: 10,                    // Max 10 fields
    fieldSize: 1024 * 1024         // 1MB per field
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  }
});

/**
 * Error handling middleware for feed uploads
 * Provides consistent error responses across routes
 */
export const feedUploadErrorHandler = (req: Request, res: Response, next: NextFunction) => {
  feedUpload.array('images', 10)(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      logger.error('Multer upload error', {
        error: err.message,
        code: err.code,
        field: err.field,
        userId: (req as any).user?.id,
        path: req.path
      });

      return res.status(400).json({
        success: false,
        error: 'Upload failed',
        message: `File upload error: ${err.message}`,
        code: err.code
      });
    }

    if (err) {
      logger.error('Feed upload error', {
        error: err.message,
        userId: (req as any).user?.id,
        path: req.path
      });

      return res.status(400).json({
        success: false,
        error: 'Upload failed',
        message: err.message
      });
    }

    next();
  });
};
