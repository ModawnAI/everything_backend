/**
 * Service Image Controller
 *
 * Handles service image management operations:
 * - Upload images to Supabase Storage
 * - Get images for a service
 * - Update image metadata
 * - Delete images
 * - Set primary image
 * - Reorder images
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  file?: Express.Multer.File;
}

export class ServiceImageController {
  private readonly BUCKET_NAME = 'service-images';
  private readonly MAX_IMAGES_PER_SERVICE = 10;

  /**
   * Upload service image
   */
  async uploadServiceImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { serviceId } = req.params;
      const file = req.file;
      const { displayOrder, altText, isPrimary } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE_PROVIDED', message: '이미지 파일이 필요합니다.' }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify service ownership
      const { data: service, error: serviceError } = await supabase
        .from('shop_services')
        .select('id, shop_id, shop:shops!inner(id, owner_id)')
        .eq('id', serviceId)
        .eq('shop.owner_id', userId)
        .single();

      if (serviceError || !service) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: '서비스를 찾을 수 없거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      // Check image count limit
      const { count: imageCount } = await supabase
        .from('service_images')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId);

      if (imageCount && imageCount >= this.MAX_IMAGES_PER_SERVICE) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MAX_IMAGES_EXCEEDED',
            message: `서비스당 최대 ${this.MAX_IMAGES_PER_SERVICE}개의 이미지만 업로드할 수 있습니다.`
          }
        });
        return;
      }

      // Generate unique filename
      const fileExt = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${serviceId}/${uuidv4()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        logger.error('Error uploading service image', {
          error: uploadError.message,
          serviceId,
          fileName
        });
        res.status(500).json({
          success: false,
          error: { code: 'UPLOAD_FAILED', message: '이미지 업로드에 실패했습니다.' }
        });
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      // Determine display order
      let order = parseInt(displayOrder) || 0;
      if (!displayOrder) {
        const { data: lastImage } = await supabase
          .from('service_images')
          .select('display_order')
          .eq('service_id', serviceId)
          .order('display_order', { ascending: false })
          .limit(1)
          .single();
        order = (lastImage?.display_order || 0) + 1;
      }

      // Handle primary image
      const setAsPrimary = isPrimary === 'true';
      if (setAsPrimary) {
        await supabase
          .from('service_images')
          .update({ is_primary: false })
          .eq('service_id', serviceId);
      }

      // Insert image record
      const { data: imageRecord, error: insertError } = await supabase
        .from('service_images')
        .insert({
          service_id: serviceId,
          image_url: urlData.publicUrl,
          storage_path: fileName,
          display_order: order,
          alt_text: altText || null,
          is_primary: setAsPrimary || imageCount === 0, // First image is primary by default
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        // Cleanup uploaded file on DB error
        await supabase.storage.from(this.BUCKET_NAME).remove([fileName]);
        logger.error('Error inserting service image record', {
          error: insertError.message,
          serviceId
        });
        res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: '이미지 정보 저장에 실패했습니다.' }
        });
        return;
      }

      logger.info('Service image uploaded successfully', {
        userId,
        serviceId,
        imageId: imageRecord.id
      });

      res.status(201).json({
        success: true,
        data: imageRecord,
        message: '이미지가 업로드되었습니다.'
      });

    } catch (error) {
      logger.error('Error in uploadServiceImage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '이미지 업로드 중 오류가 발생했습니다.' }
      });
    }
  }

  /**
   * Get all images for a service
   */
  async getServiceImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { serviceId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify service ownership
      const { data: service, error: serviceError } = await supabase
        .from('shop_services')
        .select('id, shop:shops!inner(owner_id)')
        .eq('id', serviceId)
        .eq('shop.owner_id', userId)
        .single();

      if (serviceError || !service) {
        res.status(404).json({
          success: false,
          error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다.' }
        });
        return;
      }

      // Get images
      const { data: images, error } = await supabase
        .from('service_images')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Error fetching service images', { error: error.message, serviceId });
        res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: '이미지 조회에 실패했습니다.' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: images || [],
        message: '이미지 목록을 조회했습니다.'
      });

    } catch (error) {
      logger.error('Error in getServiceImages', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '이미지 조회 중 오류가 발생했습니다.' }
      });
    }
  }

  /**
   * Update image metadata
   */
  async updateServiceImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { serviceId, imageId } = req.params;
      const { displayOrder, altText, isPrimary } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify service and image ownership
      const { data: image, error: imageError } = await supabase
        .from('service_images')
        .select('id, service_id, service:shop_services!inner(id, shop:shops!inner(owner_id))')
        .eq('id', imageId)
        .eq('service_id', serviceId)
        .eq('service.shop.owner_id', userId)
        .single();

      if (imageError || !image) {
        res.status(404).json({
          success: false,
          error: { code: 'IMAGE_NOT_FOUND', message: '이미지를 찾을 수 없습니다.' }
        });
        return;
      }

      // Handle primary image change
      if (isPrimary === true) {
        await supabase
          .from('service_images')
          .update({ is_primary: false })
          .eq('service_id', serviceId);
      }

      // Update image
      const updateData: any = { updated_at: new Date().toISOString() };
      if (displayOrder !== undefined) updateData.display_order = displayOrder;
      if (altText !== undefined) updateData.alt_text = altText;
      if (isPrimary !== undefined) updateData.is_primary = isPrimary;

      const { data: updatedImage, error: updateError } = await supabase
        .from('service_images')
        .update(updateData)
        .eq('id', imageId)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating service image', { error: updateError.message, imageId });
        res.status(500).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: '이미지 수정에 실패했습니다.' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updatedImage,
        message: '이미지가 수정되었습니다.'
      });

    } catch (error) {
      logger.error('Error in updateServiceImage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '이미지 수정 중 오류가 발생했습니다.' }
      });
    }
  }

  /**
   * Delete service image
   */
  async deleteServiceImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { serviceId, imageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify service and image ownership
      const { data: image, error: imageError } = await supabase
        .from('service_images')
        .select('id, storage_path, is_primary, service:shop_services!inner(id, shop:shops!inner(owner_id))')
        .eq('id', imageId)
        .eq('service_id', serviceId)
        .eq('service.shop.owner_id', userId)
        .single();

      if (imageError || !image) {
        res.status(404).json({
          success: false,
          error: { code: 'IMAGE_NOT_FOUND', message: '이미지를 찾을 수 없습니다.' }
        });
        return;
      }

      // Delete from storage
      if (image.storage_path) {
        await supabase.storage.from(this.BUCKET_NAME).remove([image.storage_path]);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('service_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) {
        logger.error('Error deleting service image', { error: deleteError.message, imageId });
        res.status(500).json({
          success: false,
          error: { code: 'DELETE_FAILED', message: '이미지 삭제에 실패했습니다.' }
        });
        return;
      }

      // If deleted image was primary, set the first remaining image as primary
      if (image.is_primary) {
        const { data: firstImage } = await supabase
          .from('service_images')
          .select('id')
          .eq('service_id', serviceId)
          .order('display_order', { ascending: true })
          .limit(1)
          .single();

        if (firstImage) {
          await supabase
            .from('service_images')
            .update({ is_primary: true })
            .eq('id', firstImage.id);
        }
      }

      logger.info('Service image deleted', { userId, serviceId, imageId });

      res.status(200).json({
        success: true,
        message: '이미지가 삭제되었습니다.'
      });

    } catch (error) {
      logger.error('Error in deleteServiceImage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '이미지 삭제 중 오류가 발생했습니다.' }
      });
    }
  }

  /**
   * Set image as primary
   */
  async setPrimaryImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { serviceId, imageId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify ownership
      const { data: image, error: imageError } = await supabase
        .from('service_images')
        .select('id, service:shop_services!inner(shop:shops!inner(owner_id))')
        .eq('id', imageId)
        .eq('service_id', serviceId)
        .eq('service.shop.owner_id', userId)
        .single();

      if (imageError || !image) {
        res.status(404).json({
          success: false,
          error: { code: 'IMAGE_NOT_FOUND', message: '이미지를 찾을 수 없습니다.' }
        });
        return;
      }

      // Reset all images to non-primary
      await supabase
        .from('service_images')
        .update({ is_primary: false })
        .eq('service_id', serviceId);

      // Set this image as primary
      const { data: updatedImage, error: updateError } = await supabase
        .from('service_images')
        .update({ is_primary: true })
        .eq('id', imageId)
        .select()
        .single();

      if (updateError) {
        res.status(500).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: '대표 이미지 설정에 실패했습니다.' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: updatedImage,
        message: '대표 이미지로 설정되었습니다.'
      });

    } catch (error) {
      logger.error('Error in setPrimaryImage', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '대표 이미지 설정 중 오류가 발생했습니다.' }
      });
    }
  }

  /**
   * Reorder images
   */
  async reorderImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { serviceId } = req.params;
      const { imageIds } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify service ownership
      const { data: service, error: serviceError } = await supabase
        .from('shop_services')
        .select('id, shop:shops!inner(owner_id)')
        .eq('id', serviceId)
        .eq('shop.owner_id', userId)
        .single();

      if (serviceError || !service) {
        res.status(404).json({
          success: false,
          error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다.' }
        });
        return;
      }

      // Update display order for each image
      const updates = imageIds.map((id: string, index: number) =>
        supabase
          .from('service_images')
          .update({ display_order: index })
          .eq('id', id)
          .eq('service_id', serviceId)
      );

      await Promise.all(updates);

      // Get updated images
      const { data: images } = await supabase
        .from('service_images')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true });

      res.status(200).json({
        success: true,
        data: images,
        message: '이미지 순서가 변경되었습니다.'
      });

    } catch (error) {
      logger.error('Error in reorderImages', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: '이미지 순서 변경 중 오류가 발생했습니다.' }
      });
    }
  }
}

export const serviceImageController = new ServiceImageController();
