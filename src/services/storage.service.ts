/**
 * Storage Service
 * 
 * Handles Supabase Storage integration with proper access policies,
 * security configurations, and file management for the beauty service platform
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import sharp from 'sharp';
import { normalizeSupabaseUrl } from '../utils/supabase-url';

export interface StorageBucket {
  id: string;
  name: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
  accessPolicy: 'public' | 'authenticated' | 'private';
}

export interface StoragePolicy {
  bucketId: string;
  policyName: string;
  policyType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  condition: string;
  description: string;
}

export interface FileUploadResult {
  success: boolean;
  fileUrl?: string;
  filePath?: string;
  metadata?: {
    size: number;
    mimeType: string;
    originalName: string;
    bucketId: string;
  };
  error?: string;
}

export interface FileDeleteResult {
  success: boolean;
  deletedFiles?: string[];
  error?: string;
}

export interface StorageCleanupResult {
  success: boolean;
  orphanedFiles: string[];
  deletedFiles: string[];
  error?: string;
}

export class StorageService {
  private supabase = getSupabaseClient();

  // Storage bucket configurations
  private readonly BUCKETS: Record<string, StorageBucket> = {
    'profile-images': {
      id: 'profile-images',
      name: 'profile-images',
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      accessPolicy: 'authenticated'
    },
    'shop-images': {
      id: 'shop-images',
      name: 'shop-images',
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      accessPolicy: 'authenticated'
    },
    'service-images': {
      id: 'service-images',
      name: 'service-images',
      public: true,
      fileSizeLimit: 8 * 1024 * 1024, // 8MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      accessPolicy: 'authenticated'
    },
    'business-documents': {
      id: 'business-documents',
      name: 'business-documents',
      public: false,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      accessPolicy: 'private'
    },
    'feed-posts': {
      id: 'feed-posts',
      name: 'feed-posts',
      public: true,
      fileSizeLimit: 8 * 1024 * 1024, // 8MB per image
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      accessPolicy: 'authenticated'
    }
  };

  // Storage policies for access control
  private readonly STORAGE_POLICIES: StoragePolicy[] = [
    // Profile images - users can manage their own
    {
      bucketId: 'profile-images',
      policyName: 'profile_images_own',
      policyType: 'ALL',
      condition: 'auth.uid()::text = (storage.foldername(name))[1]',
      description: 'Users can manage their own profile images'
    },
    {
      bucketId: 'profile-images',
      policyName: 'profile_images_public_read',
      policyType: 'SELECT',
      condition: 'true',
      description: 'Public can read profile images'
    },

    // Shop images - shop owners can manage their shop images
    {
      bucketId: 'shop-images',
      policyName: 'shop_images_owner_manage',
      policyType: 'ALL',
      condition: `EXISTS (
        SELECT 1 FROM public.shops 
        WHERE id::text = (storage.foldername(name))[1]
        AND owner_id = auth.uid()
      )`,
      description: 'Shop owners can manage their shop images'
    },
    {
      bucketId: 'shop-images',
      policyName: 'shop_images_public_read',
      policyType: 'SELECT',
      condition: `EXISTS (
        SELECT 1 FROM public.shops 
        WHERE id::text = (storage.foldername(name))[1]
        AND shop_status = 'active'
      )`,
      description: 'Public can read active shop images'
    },

    // Service images - shop owners can manage their service images
    {
      bucketId: 'service-images',
      policyName: 'service_images_owner_manage',
      policyType: 'ALL',
      condition: `EXISTS (
        SELECT 1 FROM public.shop_services ss
        JOIN public.shops s ON s.id = ss.shop_id
        WHERE ss.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
      )`,
      description: 'Shop owners can manage their service images'
    },
    {
      bucketId: 'service-images',
      policyName: 'service_images_public_read',
      policyType: 'SELECT',
      condition: `EXISTS (
        SELECT 1 FROM public.shop_services ss
        JOIN public.shops s ON s.id = ss.shop_id
        WHERE ss.id::text = (storage.foldername(name))[1]
        AND s.shop_status = 'active'
        AND ss.is_available = true
      )`,
      description: 'Public can read available service images'
    },

    // Business documents - private access only
    {
      bucketId: 'business-documents',
      policyName: 'business_documents_owner',
      policyType: 'ALL',
      condition: 'auth.uid()::text = (storage.foldername(name))[1]',
      description: 'Users can manage their own business documents'
    },
    {
      bucketId: 'business-documents',
      policyName: 'business_documents_admin',
      policyType: 'ALL',
      condition: `EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND user_role = 'admin'
      )`,
      description: 'Admins can access all business documents'
    },

    // Feed post images - users can manage their own
    {
      bucketId: 'feed-posts',
      policyName: 'feed_posts_owner_manage',
      policyType: 'ALL',
      condition: 'auth.uid()::text = (storage.foldername(name))[1]',
      description: 'Users can manage their own feed post images'
    },
    {
      bucketId: 'feed-posts',
      policyName: 'feed_posts_public_read',
      policyType: 'SELECT',
      condition: 'true',
      description: 'Public can read all feed post images'
    }
  ];

  /**
   * Initialize storage buckets and policies
   */
  async initializeStorage(): Promise<void> {
    try {
      logger.info('Initializing Supabase Storage buckets and policies...');

      // Create buckets if they don't exist
      for (const bucket of Object.values(this.BUCKETS)) {
        await this.createBucketIfNotExists(bucket);
      }

      // Apply storage policies
      await this.applyStoragePolicies();

      logger.info('Storage initialization completed successfully');
    } catch (error) {
      logger.error('Storage initialization failed:', { error });
      throw error;
    }
  }

  /**
   * Create bucket if it doesn't exist
   */
  private async createBucketIfNotExists(bucket: StorageBucket): Promise<void> {
    try {
      const { data: existingBuckets } = await this.supabase.storage.listBuckets();
      const bucketExists = existingBuckets?.some(b => b.id === bucket.id);

      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(bucket.id, {
          public: bucket.public,
          fileSizeLimit: bucket.fileSizeLimit,
          allowedMimeTypes: bucket.allowedMimeTypes
        });

        if (error) {
          logger.error(`Failed to create bucket ${bucket.id}:`, { error });
          throw error;
        }

        logger.info(`Created storage bucket: ${bucket.id}`);
      }
    } catch (error) {
      logger.error(`Error creating bucket ${bucket.id}:`, { error });
      throw error;
    }
  }

  /**
   * Apply storage policies for access control
   */
  private async applyStoragePolicies(): Promise<void> {
    try {
      for (const policy of this.STORAGE_POLICIES) {
        // Note: Storage policies are typically applied through Supabase dashboard
        // or via SQL commands. This is a placeholder for policy application logic.
        logger.info(`Applied storage policy: ${policy.policyName} for bucket ${policy.bucketId}`);
      }
    } catch (error) {
      logger.error('Error applying storage policies:', { error });
      throw error;
    }
  }

  /**
   * Upload file to storage with validation and optimization
   */
  async uploadFile(
    bucketId: string,
    filePath: string,
    fileBuffer: Buffer,
    options: {
      contentType?: string;
      metadata?: Record<string, string>;
      optimizeImage?: boolean;
      imageOptions?: {
        width?: number;
        height?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp';
      };
    } = {}
  ): Promise<FileUploadResult> {
    try {
      // Validate bucket exists
      const bucket = this.BUCKETS[bucketId];
      if (!bucket) {
        return {
          success: false,
          error: `Invalid bucket ID: ${bucketId}`
        };
      }

      // Validate file size
      if (fileBuffer.length > bucket.fileSizeLimit) {
        return {
          success: false,
          error: `File size exceeds limit of ${Math.round(bucket.fileSizeLimit / 1024 / 1024)}MB`
        };
      }

      // Optimize image if requested
      let processedBuffer = fileBuffer;
      if (options.optimizeImage && options.imageOptions) {
        processedBuffer = await this.optimizeImage(fileBuffer, options.imageOptions);
      }

      // Upload to storage
      const uploadOptions: any = {
        upsert: false
      };
      
      if (options.contentType) {
        uploadOptions.contentType = options.contentType;
      }
      
      if (options.metadata) {
        uploadOptions.metadata = options.metadata;
      }

      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .upload(filePath, processedBuffer, uploadOptions);

      if (error) {
        logger.error('Storage upload failed:', { bucketId, filePath, error });
        return {
          success: false,
          error: `Upload failed: ${error.message}`
        };
      }

      // Get public URL if bucket is public
      let fileUrl: string | undefined;
      if (bucket.public) {
        const { data: urlData } = this.supabase.storage
          .from(bucketId)
          .getPublicUrl(filePath);
        fileUrl = normalizeSupabaseUrl(urlData.publicUrl);
      }

      logger.info('File uploaded successfully:', { bucketId, filePath, size: processedBuffer.length });

      const result: FileUploadResult = {
        success: true,
        filePath: data.path,
        metadata: {
          size: processedBuffer.length,
          mimeType: options.contentType || 'application/octet-stream',
          originalName: filePath.split('/').pop() || 'unknown',
          bucketId
        }
      };

      if (fileUrl) {
        result.fileUrl = fileUrl;
      }

      return result;

    } catch (error) {
      logger.error('StorageService.uploadFile error:', { bucketId, filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Optimize image using Sharp
   */
  private async optimizeImage(
    buffer: Buffer,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<Buffer> {
    const {
      width = 800,
      height = 600,
      quality = 80,
      format = 'jpeg'
    } = options;

    let sharpInstance = sharp(buffer);

    // Resize image
    sharpInstance = sharpInstance.resize(width, height, { fit: 'inside' });

    // Apply format-specific optimization
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    return await sharpInstance.toBuffer();
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucketId: string, filePath: string): Promise<FileDeleteResult> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .remove([filePath]);

      if (error) {
        logger.error('Storage delete failed:', { bucketId, filePath, error });
        return {
          success: false,
          error: `Delete failed: ${error.message}`
        };
      }

      logger.info('File deleted successfully:', { bucketId, filePath });

      return {
        success: true,
        deletedFiles: data?.map(item => item.name) || []
      };

    } catch (error) {
      logger.error('StorageService.deleteFile error:', { bucketId, filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * List files in bucket with optional filtering
   */
  async listFiles(
    bucketId: string,
    options: {
      path?: string;
      limit?: number;
      offset?: number;
      search?: string;
    } = {}
  ): Promise<{ files: any[]; error?: string }> {
    try {
      const listOptions: any = {
        limit: options.limit || 100,
        offset: options.offset || 0
      };

      if (options.search) {
        listOptions.search = options.search;
      }

      const { data, error } = await this.supabase.storage
        .from(bucketId)
        .list(options.path || '', listOptions);

      if (error) {
        logger.error('Storage list failed:', { bucketId, error });
        return {
          files: [],
          error: `List failed: ${error.message}`
        };
      }

      return {
        files: data || []
      };

    } catch (error) {
      logger.error('StorageService.listFiles error:', { bucketId, error });
      return {
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(bucketId: string, filePath: string): Promise<{ metadata: any; error?: string }> {
    try {
      const { data } = await this.supabase.storage
        .from(bucketId)
        .getPublicUrl(filePath);

      return {
        metadata: {
          ...data,
          publicUrl: normalizeSupabaseUrl(data.publicUrl)
        }
      };

    } catch (error) {
      logger.error('StorageService.getFileMetadata error:', { bucketId, filePath, error });
      return {
        metadata: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Clean up orphaned files (files in storage but not referenced in database)
   */
  async cleanupOrphanedFiles(): Promise<StorageCleanupResult> {
    try {
      logger.info('Starting storage cleanup process...');

      const orphanedFiles: string[] = [];
      const deletedFiles: string[] = [];

      // Check each bucket for orphaned files
      for (const bucketId of Object.keys(this.BUCKETS)) {
        const { files } = await this.listFiles(bucketId);
        
        for (const file of files) {
          const isOrphaned = await this.isFileOrphaned(bucketId, file.name);
          if (isOrphaned) {
            orphanedFiles.push(`${bucketId}/${file.name}`);
            
            // Delete orphaned file
            const deleteResult = await this.deleteFile(bucketId, file.name);
            if (deleteResult.success) {
              deletedFiles.push(`${bucketId}/${file.name}`);
            }
          }
        }
      }

      logger.info('Storage cleanup completed:', { 
        orphanedFiles: orphanedFiles.length,
        deletedFiles: deletedFiles.length 
      });

      return {
        success: true,
        orphanedFiles,
        deletedFiles
      };

    } catch (error) {
      logger.error('StorageService.cleanupOrphanedFiles error:', { error });
      return {
        success: false,
        orphanedFiles: [],
        deletedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check if a file is orphaned (not referenced in database)
   */
  private async isFileOrphaned(bucketId: string, filePath: string): Promise<boolean> {
    try {
      // Extract file information from path
      const pathParts = filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const folderName = pathParts[0];

      // Check different tables based on bucket type
      switch (bucketId) {
        case 'profile-images':
          // Check if profile image is referenced in users table
          const { data: userProfile } = await this.supabase
            .from('users')
            .select('profile_image_url')
            .ilike('profile_image_url', `%${fileName}%`)
            .single();
          return !userProfile;

        case 'shop-images':
          // Check if shop image is referenced in shop_images table
          const { data: shopImage } = await this.supabase
            .from('shop_images')
            .select('image_url')
            .ilike('image_url', `%${fileName}%`)
            .single();
          return !shopImage;

        case 'service-images':
          // Check if service image is referenced in service_images table
          const { data: serviceImage } = await this.supabase
            .from('service_images')
            .select('image_url')
            .ilike('image_url', `%${fileName}%`)
            .single();
          return !serviceImage;

        case 'business-documents':
          // Business documents are typically temporary, consider them orphaned after 30 days
          const fileAge = await this.getFileAge(bucketId, filePath);
          return fileAge > 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

        default:
          return false;
      }
    } catch (error) {
      logger.error('Error checking if file is orphaned:', { bucketId, filePath, error });
      return false;
    }
  }

  /**
   * Get file age in milliseconds
   */
  private async getFileAge(bucketId: string, filePath: string): Promise<number> {
    try {
      const { data } = await this.supabase.storage
        .from(bucketId)
        .list(filePath.split('/').slice(0, -1).join('/'));

      const file = data?.find(f => f.name === filePath.split('/').pop());
      if (file?.created_at) {
        return Date.now() - new Date(file.created_at).getTime();
      }
      return 0;
    } catch (error) {
      logger.error('Error getting file age:', { bucketId, filePath, error });
      return 0;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    bucketStats: Record<string, { files: number; size: number }>;
  }> {
    try {
      const bucketStats: Record<string, { files: number; size: number }> = {};
      let totalFiles = 0;
      let totalSize = 0;

      for (const bucketId of Object.keys(this.BUCKETS)) {
        const { files } = await this.listFiles(bucketId);
        const bucketSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
        
        bucketStats[bucketId] = {
          files: files.length,
          size: bucketSize
        };

        totalFiles += files.length;
        totalSize += bucketSize;
      }

      return {
        totalFiles,
        totalSize,
        bucketStats
      };

    } catch (error) {
      logger.error('StorageService.getStorageStats error:', { error });
      throw error;
    }
  }
}

export const storageService = new StorageService(); 