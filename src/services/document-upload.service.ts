/**
 * Document Upload Service
 * 
 * Handles document and image uploads for shop registration including:
 * - Business license document uploads
 * - Shop image uploads with resizing
 * - File validation and security checks
 * - Supabase Storage integration
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

// File upload configuration
const UPLOAD_CONFIG = {
  // Business license documents
  businessLicense: {
    bucket: 'business-documents',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    folder: 'business-licenses'
  },
  
  // Shop images
  shopImages: {
    bucket: 'shop-images',
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'shops'
  },
  
  // Profile images
  profileImages: {
    bucket: 'profile-images',
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'users'
  }
};

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
  metadata?: {
    size: number;
    type: string;
    originalName: string;
  };
}

export interface UploadOptions {
  userId: string;
  shopId?: string;
  category: 'businessLicense' | 'shopImages' | 'profileImages';
  originalName: string;
  overwrite?: boolean;
  generateThumbnail?: boolean;
}

export class DocumentUploadService {
  private supabase = getSupabaseClient();

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      const config = UPLOAD_CONFIG[options.category];
      
      // Validate file size
      if (fileBuffer.length > config.maxSize) {
        return {
          success: false,
          error: `파일 크기가 너무 큽니다. 최대 ${Math.round(config.maxSize / 1024 / 1024)}MB까지 업로드 가능합니다.`
        };
      }

      // Generate file path
      const filePath = this.generateFilePath(options);
      
      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(config.bucket)
        .upload(filePath, fileBuffer, {
          contentType: this.detectContentType(fileBuffer, options.originalName),
          upsert: options.overwrite || false
        });

      if (error) {
        logger.error('File upload failed', {
          error: error.message,
          filePath,
          userId: options.userId,
          category: options.category
        });
        return {
          success: false,
          error: '파일 업로드에 실패했습니다.'
        };
      }

      // Get public URL
      const { data: publicUrlData } = this.supabase.storage
        .from(config.bucket)
        .getPublicUrl(filePath);

      logger.info('File uploaded successfully', {
        filePath,
        userId: options.userId,
        category: options.category,
        size: fileBuffer.length
      });

      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: filePath,
        metadata: {
          size: fileBuffer.length,
          type: this.detectContentType(fileBuffer, options.originalName),
          originalName: options.originalName
        }
      };

    } catch (error) {
      logger.error('Document upload service error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: options.userId,
        category: options.category
      });
      return {
        success: false,
        error: '파일 업로드 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * Upload multiple files (for shop image galleries)
   */
  async uploadMultipleFiles(
    files: Array<{ buffer: Buffer; originalName: string }>,
    options: Omit<UploadOptions, 'originalName'>
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadFile(file.buffer, {
        ...options,
        originalName: file.originalName
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Delete a file from Supabase Storage
   */
  async deleteFile(
    filePath: string,
    category: keyof typeof UPLOAD_CONFIG
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = UPLOAD_CONFIG[category];
      
      const { error } = await this.supabase.storage
        .from(config.bucket)
        .remove([filePath]);

      if (error) {
        logger.error('File deletion failed', {
          error: error.message,
          filePath,
          category
        });
        return {
          success: false,
          error: '파일 삭제에 실패했습니다.'
        };
      }

      logger.info('File deleted successfully', {
        filePath,
        category
      });

      return { success: true };

    } catch (error) {
      logger.error('File deletion error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath,
        category
      });
      return {
        success: false,
        error: '파일 삭제 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * Validate file type and content
   */
  validateFile(
    fileBuffer: Buffer,
    originalName: string,
    category: keyof typeof UPLOAD_CONFIG
  ): { isValid: boolean; error?: string } {
    const config = UPLOAD_CONFIG[category];
    
    // Check file size
    if (fileBuffer.length > config.maxSize) {
      return {
        isValid: false,
        error: `파일 크기가 너무 큽니다. 최대 ${Math.round(config.maxSize / 1024 / 1024)}MB까지 업로드 가능합니다.`
      };
    }

    // Check file type by content (magic numbers)
    const contentType = this.detectContentType(fileBuffer, originalName);
    if (!config.allowedTypes.includes(contentType)) {
      return {
        isValid: false,
        error: `지원하지 않는 파일 형식입니다. 허용된 형식: ${config.allowedTypes.join(', ')}`
      };
    }

    // Additional security checks
    if (this.containsMaliciousContent(fileBuffer)) {
      return {
        isValid: false,
        error: '보안상 위험한 파일입니다.'
      };
    }

    return { isValid: true };
  }

  /**
   * Generate unique file path
   */
  private generateFilePath(options: UploadOptions): string {
    const config = UPLOAD_CONFIG[options.category];
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = this.getFileExtension(options.originalName);
    
    let basePath = `${config.folder}/${options.userId}`;
    
    if (options.shopId) {
      basePath += `/${options.shopId}`;
    }
    
    return `${basePath}/${timestamp}_${randomString}${extension}`;
  }

  /**
   * Detect content type from file buffer and name
   */
  private detectContentType(fileBuffer: Buffer, originalName: string): string {
    // Check magic numbers (file signatures)
    const magicNumbers = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
      'application/pdf': [0x25, 0x50, 0x44, 0x46] // %PDF
    };

    for (const [mimeType, signature] of Object.entries(magicNumbers)) {
      if (this.matchesSignature(fileBuffer, signature)) {
        return mimeType;
      }
    }

    // Fallback to file extension
    const extension = this.getFileExtension(originalName).toLowerCase();
    const extensionMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf'
    };

    return extensionMap[extension] || 'application/octet-stream';
  }

  /**
   * Check if buffer matches file signature
   */
  private matchesSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false;
    
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }
    
    return true;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  /**
   * Basic malicious content detection
   */
  private containsMaliciousContent(buffer: Buffer): boolean {
    // Check for common malicious patterns
    const maliciousPatterns = [
      // Script tags
      Buffer.from('<script', 'utf8'),
      Buffer.from('javascript:', 'utf8'),
      // Executable signatures
      Buffer.from('MZ'), // PE executable
      Buffer.from('\x7fELF'), // ELF executable
    ];

    for (const pattern of maliciousPatterns) {
      if (buffer.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get file info from URL
   */
  async getFileInfo(url: string): Promise<{
    exists: boolean;
    size?: number;
    contentType?: string;
    lastModified?: Date;
  }> {
    try {
      // Extract bucket and path from URL
      const urlParts = url.split('/');
      const bucket = urlParts[urlParts.length - 3];
      const path = urlParts.slice(-2).join('/');

      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(path.split('/')[0], {
          search: path.split('/')[1]
        });

      if (error || !data || data.length === 0) {
        return { exists: false };
      }

      const fileInfo = data[0];
      return {
        exists: true,
        size: fileInfo.metadata?.size,
        contentType: fileInfo.metadata?.mimetype,
        lastModified: new Date(fileInfo.updated_at)
      };

    } catch (error) {
      logger.error('Failed to get file info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url
      });
      return { exists: false };
    }
  }

  /**
   * Generate signed URL for temporary access
   */
  async generateSignedUrl(
    filePath: string,
    category: keyof typeof UPLOAD_CONFIG,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const config = UPLOAD_CONFIG[category];
      
      const { data, error } = await this.supabase.storage
        .from(config.bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        return {
          success: false,
          error: '임시 URL 생성에 실패했습니다.'
        };
      }

      return {
        success: true,
        url: data.signedUrl
      };

    } catch (error) {
      logger.error('Signed URL generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath,
        category
      });
      return {
        success: false,
        error: '임시 URL 생성 중 오류가 발생했습니다.'
      };
    }
  }
}

// Export singleton instance
export const documentUploadService = new DocumentUploadService();

