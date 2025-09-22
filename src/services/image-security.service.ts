/**
 * Enhanced Image Security Validation Service
 * 
 * Provides comprehensive security validation for image uploads including:
 * - Magic byte verification for true file type detection
 * - Image content scanning for malicious embedded content
 * - File signature validation beyond MIME type checking
 * - Advanced security checks against malicious uploads
 */

import { logger } from '../utils/logger';

// Magic byte signatures for common image formats
const MAGIC_BYTES = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // Standard JPEG
    [0xFF, 0xD8, 0xFF, 0xE0], // JFIF JPEG
    [0xFF, 0xD8, 0xFF, 0xE1], // EXIF JPEG
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // WebP (RIFF header)
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/bmp': [
    [0x42, 0x4D], // BMP
  ],
  'image/tiff': [
    [0x49, 0x49, 0x2A, 0x00], // TIFF (little endian)
    [0x4D, 0x4D, 0x00, 0x2A], // TIFF (big endian)
  ],
};

// Suspicious patterns that might indicate malicious content
const SUSPICIOUS_PATTERNS = [
  // Script tags
  /<script[^>]*>/i,
  /<\/script>/i,
  // JavaScript
  /javascript:/i,
  /vbscript:/i,
  // PHP tags
  /<\?php/i,
  /<\?=/i,
  // SQL injection patterns
  /union\s+select/i,
  /drop\s+table/i,
  /insert\s+into/i,
  // Executable patterns
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  // Base64 encoded content (might be suspicious)
  /data:image\/[^;]+;base64,/i,
];

// Maximum allowed dimensions to prevent DoS attacks
const MAX_DIMENSIONS = {
  width: 4096,
  height: 4096,
};

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export interface ImageSecurityValidationResult {
  isValid: boolean;
  detectedMimeType?: string;
  errors: string[];
  warnings: string[];
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export class ImageSecurityService {
  /**
   * Comprehensive image security validation
   */
  static async validateImageSecurity(
    buffer: Buffer,
    fileName: string,
    mimeType?: string
  ): Promise<ImageSecurityValidationResult> {
    const result: ImageSecurityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // 1. Basic file size validation
      this.validateFileSize(buffer, result);

      // 2. Magic byte verification
      this.validateMagicBytes(buffer, result);

      // 3. MIME type validation
      this.validateMimeType(mimeType, result);

      // 4. File extension validation
      this.validateFileExtension(fileName, result);

      // 5. Content scanning for malicious patterns
      await this.scanForMaliciousContent(buffer, result);

      // 6. Image metadata validation
      await this.validateImageMetadata(buffer, result);

      // 7. Additional security checks
      this.performAdditionalSecurityChecks(buffer, result);

      // Determine overall validity
      result.isValid = result.errors.length === 0;

      // Log security validation results
      this.logValidationResults(fileName, result);

    } catch (error) {
      logger.error('Image security validation error', {
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      result.isValid = false;
      result.errors.push('이미지 보안 검증 중 오류가 발생했습니다.');
    }

    return result;
  }

  /**
   * Validate file size
   */
  private static validateFileSize(buffer: Buffer, result: ImageSecurityValidationResult): void {
    if (buffer.length > MAX_FILE_SIZE) {
      result.errors.push(`파일 크기는 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB 이하여야 합니다.`);
    }

    if (buffer.length === 0) {
      result.errors.push('빈 파일은 업로드할 수 없습니다.');
    }
  }

  /**
   * Validate magic bytes to detect true file type
   */
  private static validateMagicBytes(buffer: Buffer, result: ImageSecurityValidationResult): void {
    if (buffer.length < 8) {
      result.errors.push('파일이 너무 작아서 유효한 이미지가 아닙니다.');
      return;
    }

    let detectedMimeType: string | null = null;

    // Check magic bytes for each supported format
    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const signature of signatures) {
        if (this.checkMagicBytes(buffer, signature)) {
          detectedMimeType = mimeType;
          break;
        }
      }
      if (detectedMimeType) break;
    }

    if (!detectedMimeType) {
      result.errors.push('지원되지 않는 파일 형식입니다. JPG, PNG, WebP 형식만 업로드 가능합니다.');
      return;
    }

    result.detectedMimeType = detectedMimeType;

    // Check if detected type is in allowed list
    if (!ALLOWED_MIME_TYPES.includes(detectedMimeType)) {
      result.errors.push(`${detectedMimeType} 형식은 지원되지 않습니다.`);
    }
  }

  /**
   * Check if buffer starts with specific magic bytes
   */
  private static checkMagicBytes(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate MIME type
   */
  private static validateMimeType(mimeType: string | undefined, result: ImageSecurityValidationResult): void {
    if (!mimeType) {
      result.warnings.push('MIME 타입이 제공되지 않았습니다.');
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      result.errors.push(`지원되지 않는 MIME 타입입니다: ${mimeType}`);
    }
  }

  /**
   * Validate file extension
   */
  private static validateFileExtension(fileName: string, result: ImageSecurityValidationResult): void {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (!extension) {
      result.errors.push('파일 확장자가 없습니다.');
      return;
    }

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedExtensions.includes(extension)) {
      result.errors.push(`지원되지 않는 파일 확장자입니다: ${extension}`);
    }

    // Check for double extensions (potential security risk)
    const parts = fileName.split('.');
    if (parts.length > 2) {
      result.warnings.push('파일명에 여러 확장자가 있습니다. 잠재적인 보안 위험이 있을 수 있습니다.');
    }
  }

  /**
   * Scan for malicious content in the file
   */
  private static async scanForMaliciousContent(buffer: Buffer, result: ImageSecurityValidationResult): Promise<void> {
    try {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024 * 1024)); // Check first 1MB

      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content)) {
          result.errors.push('의심스러운 내용이 감지되었습니다. 파일을 다시 확인해주세요.');
          logger.warn('Suspicious content detected in image', {
            pattern: pattern.toString(),
            content: content.substring(0, 200), // Log first 200 chars
          });
          break; // Stop at first suspicious pattern found
        }
      }

      // Check for excessive null bytes (potential steganography)
      const nullByteCount = (content.match(/\0/g) || []).length;
      if (nullByteCount > 100) {
        result.warnings.push('파일에 과도한 null 바이트가 있습니다.');
      }

    } catch (error) {
      result.warnings.push('파일 내용 검사 중 오류가 발생했습니다.');
      logger.warn('Content scanning error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validate image metadata
   */
  private static async validateImageMetadata(buffer: Buffer, result: ImageSecurityValidationResult): Promise<void> {
    try {
      // This would typically use a library like 'sharp' or 'image-size'
      // For now, we'll do basic validation
      
      // Check for minimum file size (too small might be invalid)
      if (buffer.length < 100) {
        result.errors.push('파일이 너무 작아서 유효한 이미지가 아닙니다.');
        return;
      }

      // Basic dimension validation would go here
      // This is a placeholder - in a real implementation, you'd use an image processing library
      result.metadata = {
        width: 0, // Would be extracted from actual image
        height: 0, // Would be extracted from actual image
        format: result.detectedMimeType || 'unknown',
        size: buffer.length,
      };

    } catch (error) {
      result.warnings.push('이미지 메타데이터 검증 중 오류가 발생했습니다.');
      logger.warn('Metadata validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Perform additional security checks
   */
  private static performAdditionalSecurityChecks(buffer: Buffer, result: ImageSecurityValidationResult): void {
    // Check for file header consistency
    if (result.detectedMimeType === 'image/jpeg') {
      this.validateJpegHeader(buffer, result);
    } else if (result.detectedMimeType === 'image/png') {
      this.validatePngHeader(buffer, result);
    }

    // Check for embedded files (basic check)
    this.checkForEmbeddedFiles(buffer, result);

    // Check for excessive entropy (might indicate encrypted content)
    this.checkEntropy(buffer, result);
  }

  /**
   * Validate JPEG header
   */
  private static validateJpegHeader(buffer: Buffer, result: ImageSecurityValidationResult): void {
    // JPEG should start with FFD8 and end with FFD9
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      result.errors.push('유효하지 않은 JPEG 파일입니다.');
      return;
    }

    // Check for proper JPEG structure
    let foundEndMarker = false;
    for (let i = 2; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
        foundEndMarker = true;
        break;
      }
    }

    if (!foundEndMarker) {
      result.warnings.push('JPEG 파일이 완전하지 않을 수 있습니다.');
    }
  }

  /**
   * Validate PNG header
   */
  private static validatePngHeader(buffer: Buffer, result: ImageSecurityValidationResult): void {
    // PNG should start with PNG signature
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < pngSignature.length; i++) {
      if (buffer[i] !== pngSignature[i]) {
        result.errors.push('유효하지 않은 PNG 파일입니다.');
        return;
      }
    }
  }

  /**
   * Check for embedded files
   */
  private static checkForEmbeddedFiles(buffer: Buffer, result: ImageSecurityValidationResult): void {
    // Look for common file signatures within the image
    const embeddedSignatures = [
      [0x50, 0x4B, 0x03, 0x04], // ZIP/Office documents
      [0x25, 0x50, 0x44, 0x46], // PDF
      [0x4D, 0x5A], // Windows executable
    ];

    for (const signature of embeddedSignatures) {
      if (this.findSignatureInBuffer(buffer, signature)) {
        result.warnings.push('파일에 다른 파일이 포함되어 있을 수 있습니다.');
        break;
      }
    }
  }

  /**
   * Find signature within buffer
   */
  private static findSignatureInBuffer(buffer: Buffer, signature: number[]): boolean {
    for (let i = 0; i <= buffer.length - signature.length; i++) {
      let found = true;
      for (let j = 0; j < signature.length; j++) {
        if (buffer[i + j] !== signature[j]) {
          found = false;
          break;
        }
      }
      if (found) return true;
    }
    return false;
  }

  /**
   * Check entropy (basic check for encrypted content)
   */
  private static checkEntropy(buffer: Buffer, result: ImageSecurityValidationResult): void {
    // Simple entropy check - count byte frequency
    const byteCounts = new Array(256).fill(0);
    const sampleSize = Math.min(buffer.length, 1024 * 1024); // Check first 1MB

    for (let i = 0; i < sampleSize; i++) {
      byteCounts[buffer[i]]++;
    }

    // Calculate entropy
    let entropy = 0;
    for (const count of byteCounts) {
      if (count > 0) {
        const probability = count / sampleSize;
        entropy -= probability * Math.log2(probability);
      }
    }

    // High entropy might indicate encrypted content
    if (entropy > 7.5) {
      result.warnings.push('파일의 엔트로피가 높습니다. 암호화된 내용이 포함되어 있을 수 있습니다.');
    }
  }

  /**
   * Log validation results
   */
  private static logValidationResults(fileName: string, result: ImageSecurityValidationResult): void {
    if (result.errors.length > 0) {
      logger.warn('Image security validation failed', {
        fileName,
        errors: result.errors,
        warnings: result.warnings,
        detectedMimeType: result.detectedMimeType,
      });
    } else if (result.warnings.length > 0) {
      logger.info('Image security validation passed with warnings', {
        fileName,
        warnings: result.warnings,
        detectedMimeType: result.detectedMimeType,
      });
    } else {
      logger.info('Image security validation passed', {
        fileName,
        detectedMimeType: result.detectedMimeType,
      });
    }
  }
}

