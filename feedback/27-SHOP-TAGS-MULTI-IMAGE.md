# Plan 27: Shop Tags & Multi-Image Profile

## Overview
This plan implements shop tags functionality and multi-image shop profiles. Shop owners can add hashtags to their shop profile for discoverability, and upload up to 5 profile images for a richer presentation. This addresses Phase 5.4 and 5.5 feedback items from IMPLEMENTATION_PLAN.md.

**Feedback Items Addressed:**
- '샵 설정'에서 #내성발톱 #웨딩네일 #강남네일 등 태그 기능 추가
- '샵 설정'에서 입점된 대표 프로필 사진 5장까지 설정 가능하게끔

---

## 1. Database Schema

### Migration: 005_add_shop_tags_table.sql

```sql
-- Shop Tags Table
CREATE TABLE shop_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, tag)
);

-- Indexes for efficient lookups
CREATE INDEX idx_shop_tags_shop ON shop_tags(shop_id);
CREATE INDEX idx_shop_tags_tag ON shop_tags(tag);
CREATE INDEX idx_shop_tags_order ON shop_tags(shop_id, display_order);

-- Popular tags view for autocomplete
CREATE OR REPLACE VIEW popular_tags AS
SELECT
  tag,
  COUNT(*) as usage_count
FROM shop_tags
GROUP BY tag
ORDER BY usage_count DESC;

-- Shop Images Table (if not exists or needs enhancement)
CREATE TABLE IF NOT EXISTS shop_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one primary image per shop
CREATE UNIQUE INDEX idx_shop_images_primary
ON shop_images(shop_id)
WHERE is_primary = true;

-- Index for ordering
CREATE INDEX idx_shop_images_order ON shop_images(shop_id, display_order);

-- Trigger to enforce max 5 images per shop
CREATE OR REPLACE FUNCTION check_shop_images_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM shop_images WHERE shop_id = NEW.shop_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 images allowed per shop';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_shop_images_limit
BEFORE INSERT ON shop_images
FOR EACH ROW
EXECUTE FUNCTION check_shop_images_limit();

-- Trigger to ensure at least one primary image
CREATE OR REPLACE FUNCTION ensure_primary_image()
RETURNS TRIGGER AS $$
BEGIN
  -- If deleting the primary image, set another as primary
  IF OLD.is_primary = true THEN
    UPDATE shop_images
    SET is_primary = true, updated_at = NOW()
    WHERE shop_id = OLD.shop_id
    AND id != OLD.id
    ORDER BY display_order
    LIMIT 1;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manage_primary_image
AFTER DELETE ON shop_images
FOR EACH ROW
EXECUTE FUNCTION ensure_primary_image();
```

---

## 2. Backend Implementation

### 2.1 Types

**File: `src/types/shop-settings.types.ts`**

```typescript
export interface ShopTag {
  id: string;
  shopId: string;
  tag: string;
  displayOrder: number;
  createdAt: Date;
}

export interface ShopImage {
  id: string;
  shopId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateShopTagsDto {
  tags: string[]; // Max 10 tags, each max 20 chars
}

export interface UpdateShopImagesDto {
  images: {
    id?: string; // Existing image ID (for reordering)
    imageUrl: string;
    displayOrder: number;
    isPrimary?: boolean;
  }[];
}

export interface PopularTag {
  tag: string;
  usageCount: number;
}

export interface ShopSettingsResponse {
  tags: ShopTag[];
  images: ShopImage[];
}
```

### 2.2 Service Layer

**File: `src/services/shop-owner/settings.service.ts`**

```typescript
import { supabase } from '@/config/supabase';
import {
  ShopTag,
  ShopImage,
  UpdateShopTagsDto,
  UpdateShopImagesDto,
  PopularTag,
} from '@/types/shop-settings.types';

export class ShopSettingsService {
  /**
   * Get shop tags
   */
  async getShopTags(shopId: string): Promise<ShopTag[]> {
    const { data, error } = await supabase
      .from('shop_tags')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order');

    if (error) {
      throw new Error(`Failed to fetch shop tags: ${error.message}`);
    }

    return (data || []).map(tag => ({
      id: tag.id,
      shopId: tag.shop_id,
      tag: tag.tag,
      displayOrder: tag.display_order,
      createdAt: new Date(tag.created_at),
    }));
  }

  /**
   * Update shop tags (replace all)
   */
  async updateShopTags(shopId: string, dto: UpdateShopTagsDto): Promise<ShopTag[]> {
    // Validate tags
    const cleanTags = dto.tags
      .map(tag => tag.trim().replace(/^#/, '')) // Remove leading #
      .filter(tag => tag.length > 0 && tag.length <= 20)
      .slice(0, 10); // Max 10 tags

    // Remove duplicates
    const uniqueTags = [...new Set(cleanTags)];

    // Start transaction
    const { error: deleteError } = await supabase
      .from('shop_tags')
      .delete()
      .eq('shop_id', shopId);

    if (deleteError) {
      throw new Error(`Failed to update tags: ${deleteError.message}`);
    }

    if (uniqueTags.length === 0) {
      return [];
    }

    // Insert new tags
    const tagsToInsert = uniqueTags.map((tag, index) => ({
      shop_id: shopId,
      tag,
      display_order: index,
    }));

    const { data, error: insertError } = await supabase
      .from('shop_tags')
      .insert(tagsToInsert)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert tags: ${insertError.message}`);
    }

    return (data || []).map(tag => ({
      id: tag.id,
      shopId: tag.shop_id,
      tag: tag.tag,
      displayOrder: tag.display_order,
      createdAt: new Date(tag.created_at),
    }));
  }

  /**
   * Get popular tags for autocomplete
   */
  async getPopularTags(limit: number = 20): Promise<PopularTag[]> {
    const { data, error } = await supabase
      .from('popular_tags')
      .select('*')
      .limit(limit);

    if (error) {
      // Fallback to direct query
      const { data: fallbackData } = await supabase
        .from('shop_tags')
        .select('tag')
        .limit(100);

      const tagCounts = new Map<string, number>();
      (fallbackData || []).forEach(item => {
        tagCounts.set(item.tag, (tagCounts.get(item.tag) || 0) + 1);
      });

      return Array.from(tagCounts.entries())
        .map(([tag, usageCount]) => ({ tag, usageCount }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
    }

    return (data || []).map(item => ({
      tag: item.tag,
      usageCount: item.usage_count,
    }));
  }

  /**
   * Search tags for autocomplete
   */
  async searchTags(query: string, limit: number = 10): Promise<string[]> {
    const { data, error } = await supabase
      .from('shop_tags')
      .select('tag')
      .ilike('tag', `%${query}%`)
      .limit(limit * 2); // Get more to filter duplicates

    if (error) {
      throw new Error(`Failed to search tags: ${error.message}`);
    }

    // Remove duplicates and return
    return [...new Set((data || []).map(item => item.tag))].slice(0, limit);
  }

  /**
   * Get shop images
   */
  async getShopImages(shopId: string): Promise<ShopImage[]> {
    const { data, error } = await supabase
      .from('shop_images')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order');

    if (error) {
      throw new Error(`Failed to fetch shop images: ${error.message}`);
    }

    return (data || []).map(img => ({
      id: img.id,
      shopId: img.shop_id,
      imageUrl: img.image_url,
      displayOrder: img.display_order,
      isPrimary: img.is_primary,
      createdAt: new Date(img.created_at),
      updatedAt: new Date(img.updated_at),
    }));
  }

  /**
   * Update shop images
   */
  async updateShopImages(shopId: string, dto: UpdateShopImagesDto): Promise<ShopImage[]> {
    // Validate max 5 images
    if (dto.images.length > 5) {
      throw new Error('Maximum 5 images allowed');
    }

    // Ensure at least one primary if images exist
    if (dto.images.length > 0) {
      const hasPrimary = dto.images.some(img => img.isPrimary);
      if (!hasPrimary) {
        dto.images[0].isPrimary = true;
      }
    }

    // Get existing images
    const existingImages = await this.getShopImages(shopId);
    const existingIds = new Set(existingImages.map(img => img.id));

    // Identify images to delete
    const newIds = new Set(dto.images.filter(img => img.id).map(img => img.id));
    const toDelete = existingImages.filter(img => !newIds.has(img.id));

    // Delete removed images
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('shop_images')
        .delete()
        .in('id', toDelete.map(img => img.id));

      if (deleteError) {
        throw new Error(`Failed to delete images: ${deleteError.message}`);
      }

      // Also delete from storage
      for (const img of toDelete) {
        await this.deleteImageFromStorage(img.imageUrl);
      }
    }

    // Update or insert images
    const upsertData = dto.images.map(img => ({
      id: img.id || undefined,
      shop_id: shopId,
      image_url: img.imageUrl,
      display_order: img.displayOrder,
      is_primary: img.isPrimary || false,
      updated_at: new Date().toISOString(),
    }));

    // Insert new images
    const newImages = upsertData.filter(img => !img.id);
    if (newImages.length > 0) {
      const { error: insertError } = await supabase
        .from('shop_images')
        .insert(newImages.map(({ id, ...rest }) => rest));

      if (insertError) {
        throw new Error(`Failed to insert images: ${insertError.message}`);
      }
    }

    // Update existing images
    const existingUpdates = upsertData.filter(img => img.id && existingIds.has(img.id));
    for (const update of existingUpdates) {
      const { error: updateError } = await supabase
        .from('shop_images')
        .update({
          image_url: update.image_url,
          display_order: update.display_order,
          is_primary: update.is_primary,
          updated_at: update.updated_at,
        })
        .eq('id', update.id);

      if (updateError) {
        throw new Error(`Failed to update image: ${updateError.message}`);
      }
    }

    // Return updated images
    return this.getShopImages(shopId);
  }

  /**
   * Upload shop image
   */
  async uploadShopImage(shopId: string, file: Buffer, fileName: string): Promise<string> {
    const filePath = `shops/${shopId}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('shop-profile-images')
      .upload(filePath, file, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('shop-profile-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  /**
   * Delete image from storage
   */
  private async deleteImageFromStorage(imageUrl: string): Promise<void> {
    try {
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/shop-profile-images\/(.+)$/);
      if (pathMatch) {
        await supabase.storage
          .from('shop-profile-images')
          .remove([pathMatch[1]]);
      }
    } catch (error) {
      // Log but don't throw - image deletion is not critical
      console.error('Failed to delete image from storage:', error);
    }
  }

  /**
   * Set primary image
   */
  async setPrimaryImage(shopId: string, imageId: string): Promise<void> {
    // Remove current primary
    await supabase
      .from('shop_images')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .eq('is_primary', true);

    // Set new primary
    const { error } = await supabase
      .from('shop_images')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', imageId)
      .eq('shop_id', shopId);

    if (error) {
      throw new Error(`Failed to set primary image: ${error.message}`);
    }
  }
}
```

### 2.3 Controller

**File: `src/controllers/shop-owner/settings.controller.ts`** (Update)

```typescript
import { Request, Response } from 'express';
import { ShopSettingsService } from '@/services/shop-owner/settings.service';
import { successResponse, errorResponse } from '@/utils/response';

const settingsService = new ShopSettingsService();

export class ShopSettingsController {
  /**
   * GET /shop-owner/settings/tags
   */
  async getTags(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const tags = await settingsService.getShopTags(shopId);
      return successResponse(res, { tags });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * PUT /shop-owner/settings/tags
   */
  async updateTags(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        return errorResponse(res, 'Tags must be an array', 400);
      }

      const updatedTags = await settingsService.updateShopTags(shopId, { tags });
      return successResponse(res, { tags: updatedTags });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * GET /shop-owner/settings/tags/popular
   */
  async getPopularTags(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const tags = await settingsService.getPopularTags(limit);
      return successResponse(res, { tags });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * GET /shop-owner/settings/tags/search
   */
  async searchTags(req: Request, res: Response) {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return successResponse(res, { tags: [] });
      }

      const tags = await settingsService.searchTags(q);
      return successResponse(res, { tags });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * GET /shop-owner/settings/images
   */
  async getImages(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const images = await settingsService.getShopImages(shopId);
      return successResponse(res, { images });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * PUT /shop-owner/settings/images
   */
  async updateImages(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { images } = req.body;

      if (!Array.isArray(images)) {
        return errorResponse(res, 'Images must be an array', 400);
      }

      if (images.length > 5) {
        return errorResponse(res, 'Maximum 5 images allowed', 400);
      }

      const updatedImages = await settingsService.updateShopImages(shopId, { images });
      return successResponse(res, { images: updatedImages });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * POST /shop-owner/settings/images/upload
   */
  async uploadImage(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      if (!req.file) {
        return errorResponse(res, 'No file uploaded', 400);
      }

      const imageUrl = await settingsService.uploadShopImage(
        shopId,
        req.file.buffer,
        req.file.originalname
      );

      return successResponse(res, { imageUrl }, 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * PATCH /shop-owner/settings/images/:imageId/primary
   */
  async setPrimaryImage(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { imageId } = req.params;

      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      await settingsService.setPrimaryImage(shopId, imageId);
      return successResponse(res, { message: 'Primary image updated' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

### 2.4 Routes

**File: `src/routes/shop-owner/settings.routes.ts`** (Update)

```typescript
import { Router } from 'express';
import { ShopSettingsController } from '@/controllers/shop-owner/settings.controller';
import { authenticate } from '@/middleware/auth';
import { shopOwnerAuth } from '@/middleware/shop-owner-auth';
import { upload } from '@/middleware/upload';

const router = Router();
const controller = new ShopSettingsController();

router.use(authenticate);
router.use(shopOwnerAuth);

// Tags
router.get('/tags', controller.getTags.bind(controller));
router.put('/tags', controller.updateTags.bind(controller));
router.get('/tags/popular', controller.getPopularTags.bind(controller));
router.get('/tags/search', controller.searchTags.bind(controller));

// Images
router.get('/images', controller.getImages.bind(controller));
router.put('/images', controller.updateImages.bind(controller));
router.post('/images/upload', upload.single('image'), controller.uploadImage.bind(controller));
router.patch('/images/:imageId/primary', controller.setPrimaryImage.bind(controller));

export default router;
```

### 2.5 Public Shop API Enhancement

**File: `src/controllers/shop.controller.ts`** (Update to include tags and images)

```typescript
// Add to getShopById method
async getShopById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const { data: shop, error } = await supabase
      .from('shops')
      .select(`
        *,
        shop_tags (
          id,
          tag,
          display_order
        ),
        shop_images (
          id,
          image_url,
          display_order,
          is_primary
        )
      `)
      .eq('id', id)
      .single();

    if (error || !shop) {
      return errorResponse(res, 'Shop not found', 404);
    }

    // Transform response
    const response = {
      ...shop,
      tags: (shop.shop_tags || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((t: any) => t.tag),
      images: (shop.shop_images || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((img: any) => ({
          id: img.id,
          url: img.image_url,
          isPrimary: img.is_primary,
        })),
    };

    return successResponse(res, response);
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
}

// Add search by tag
async searchByTag(req: Request, res: Response) {
  try {
    const { tag } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const { data, error, count } = await supabase
      .from('shop_tags')
      .select(`
        shops:shop_id (
          id,
          name,
          address,
          profile_image,
          rating,
          review_count
        )
      `, { count: 'exact' })
      .eq('tag', tag)
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      throw new Error(error.message);
    }

    const shops = (data || [])
      .map(item => item.shops)
      .filter(Boolean);

    return successResponse(res, {
      tag,
      shops,
      total: count || 0,
      hasMore: (count || 0) > offset + Number(limit),
    });
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
}
```

---

## 3. Admin Panel Implementation

### 3.1 Shop Settings Page Enhancement

**File: `src/app/dashboard/my-shop/settings/page.tsx`** (Update)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Form,
  Input,
  Button,
  Tag,
  Upload,
  message,
  Space,
  AutoComplete,
  Image,
  Tooltip,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  CloseOutlined,
  StarFilled,
  StarOutlined,
  DragOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { shopOwnerApi } from '@/lib/api/shop-owner';

// Sortable Image Component
interface SortableImageProps {
  id: string;
  url: string;
  isPrimary: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
}

function SortableImage({ id, url, isPrimary, onSetPrimary, onRemove }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isPrimary ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <Image
          src={url}
          alt="Shop image"
          width={120}
          height={120}
          className="object-cover rounded-lg"
          preview
        />
      </div>
      <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        <Tooltip title={isPrimary ? '대표 이미지' : '대표로 설정'}>
          <Button
            size="small"
            type={isPrimary ? 'primary' : 'default'}
            icon={isPrimary ? <StarFilled /> : <StarOutlined />}
            onClick={onSetPrimary}
          />
        </Tooltip>
        <Tooltip title="삭제">
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={onRemove}
          />
        </Tooltip>
      </div>
      {isPrimary && (
        <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
          대표
        </div>
      )}
    </div>
  );
}

export default function ShopSettingsPage() {
  const queryClient = useQueryClient();
  const [tagInputValue, setTagInputValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<{ id: string; url: string; isPrimary: boolean }[]>([]);
  const [tagOptions, setTagOptions] = useState<{ value: string }[]>([]);

  // Fetch current tags
  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['shop-tags'],
    queryFn: () => shopOwnerApi.getShopTags(),
  });

  // Fetch current images
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['shop-images'],
    queryFn: () => shopOwnerApi.getShopImages(),
  });

  // Fetch popular tags
  const { data: popularTags } = useQuery({
    queryKey: ['popular-tags'],
    queryFn: () => shopOwnerApi.getPopularTags(),
  });

  useEffect(() => {
    if (tagsData?.tags) {
      setTags(tagsData.tags.map((t: any) => t.tag));
    }
  }, [tagsData]);

  useEffect(() => {
    if (imagesData?.images) {
      setImages(imagesData.images.map((img: any) => ({
        id: img.id,
        url: img.imageUrl,
        isPrimary: img.isPrimary,
      })));
    }
  }, [imagesData]);

  // Save tags mutation
  const saveTagsMutation = useMutation({
    mutationFn: (newTags: string[]) => shopOwnerApi.updateShopTags(newTags),
    onSuccess: () => {
      message.success('태그가 저장되었습니다');
      queryClient.invalidateQueries({ queryKey: ['shop-tags'] });
    },
    onError: (error: any) => {
      message.error(error.message || '태그 저장에 실패했습니다');
    },
  });

  // Save images mutation
  const saveImagesMutation = useMutation({
    mutationFn: (newImages: { id?: string; imageUrl: string; displayOrder: number; isPrimary: boolean }[]) =>
      shopOwnerApi.updateShopImages(newImages),
    onSuccess: () => {
      message.success('이미지가 저장되었습니다');
      queryClient.invalidateQueries({ queryKey: ['shop-images'] });
    },
    onError: (error: any) => {
      message.error(error.message || '이미지 저장에 실패했습니다');
    },
  });

  // Upload image mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => shopOwnerApi.uploadShopImage(file),
    onSuccess: (data) => {
      const newImage = {
        id: `temp-${Date.now()}`,
        url: data.imageUrl,
        isPrimary: images.length === 0,
      };
      setImages([...images, newImage]);
      message.success('이미지가 업로드되었습니다');
    },
    onError: (error: any) => {
      message.error(error.message || '이미지 업로드에 실패했습니다');
    },
  });

  // Search tags
  const handleTagSearch = async (value: string) => {
    if (value.length < 1) {
      setTagOptions(popularTags?.tags?.map((t: any) => ({ value: t.tag })) || []);
      return;
    }
    try {
      const result = await shopOwnerApi.searchTags(value);
      setTagOptions(result.tags.map((tag: string) => ({ value: tag })));
    } catch {
      setTagOptions([]);
    }
  };

  // Add tag
  const handleAddTag = () => {
    const cleanTag = tagInputValue.trim().replace(/^#/, '');
    if (cleanTag && !tags.includes(cleanTag) && tags.length < 10) {
      setTags([...tags, cleanTag]);
      setTagInputValue('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Save tags
  const handleSaveTags = () => {
    saveTagsMutation.mutate(tags);
  };

  // Handle image drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex(img => img.id === active.id);
      const newIndex = images.findIndex(img => img.id === over.id);
      setImages(arrayMove(images, oldIndex, newIndex));
    }
  };

  // Set primary image
  const handleSetPrimary = (imageId: string) => {
    setImages(images.map(img => ({
      ...img,
      isPrimary: img.id === imageId,
    })));
  };

  // Remove image
  const handleRemoveImage = (imageId: string) => {
    const newImages = images.filter(img => img.id !== imageId);
    // Ensure at least one primary
    if (newImages.length > 0 && !newImages.some(img => img.isPrimary)) {
      newImages[0].isPrimary = true;
    }
    setImages(newImages);
  };

  // Save images
  const handleSaveImages = () => {
    const imagesToSave = images.map((img, index) => ({
      id: img.id.startsWith('temp-') ? undefined : img.id,
      imageUrl: img.url,
      displayOrder: index,
      isPrimary: img.isPrimary,
    }));
    saveImagesMutation.mutate(imagesToSave);
  };

  // Handle image upload
  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    if (images.length >= 5) {
      message.error('최대 5장까지 업로드할 수 있습니다');
      return;
    }
    try {
      await uploadMutation.mutateAsync(file as File);
      onSuccess?.({});
    } catch (error: any) {
      onError?.(error);
    }
  };

  if (tagsLoading || imagesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">샵 설정</h1>

      {/* Tags Section */}
      <Card title="샵 태그" extra={<span className="text-gray-500">{tags.length}/10</span>}>
        <p className="text-gray-500 mb-4">
          고객이 쉽게 찾을 수 있도록 샵을 설명하는 태그를 추가하세요. (최대 10개)
        </p>

        <div className="mb-4">
          <Space.Compact style={{ width: '100%' }}>
            <AutoComplete
              value={tagInputValue}
              options={tagOptions}
              onSearch={handleTagSearch}
              onChange={setTagInputValue}
              onSelect={(value) => {
                setTagInputValue(value);
                setTimeout(() => handleAddTag(), 0);
              }}
              placeholder="태그 입력 (예: 웨딩네일, 내성발톱)"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button
              type="primary"
              onClick={handleAddTag}
              disabled={!tagInputValue.trim() || tags.length >= 10}
            >
              추가
            </Button>
          </Space.Compact>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map(tag => (
            <Tag
              key={tag}
              closable
              onClose={() => handleRemoveTag(tag)}
              className="text-sm py-1 px-3"
            >
              #{tag}
            </Tag>
          ))}
          {tags.length === 0 && (
            <span className="text-gray-400">등록된 태그가 없습니다</span>
          )}
        </div>

        {/* Popular Tags Suggestions */}
        {popularTags?.tags && popularTags.tags.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">인기 태그:</p>
            <div className="flex flex-wrap gap-2">
              {popularTags.tags.slice(0, 10).map((item: any) => (
                <Tag
                  key={item.tag}
                  className="cursor-pointer hover:bg-blue-50"
                  onClick={() => {
                    if (!tags.includes(item.tag) && tags.length < 10) {
                      setTags([...tags, item.tag]);
                    }
                  }}
                >
                  #{item.tag}
                </Tag>
              ))}
            </div>
          </div>
        )}

        <Button
          type="primary"
          onClick={handleSaveTags}
          loading={saveTagsMutation.isPending}
        >
          태그 저장
        </Button>
      </Card>

      {/* Images Section */}
      <Card title="샵 이미지" extra={<span className="text-gray-500">{images.length}/5</span>}>
        <p className="text-gray-500 mb-4">
          샵을 대표하는 이미지를 최대 5장까지 등록할 수 있습니다. 드래그하여 순서를 변경하세요.
        </p>

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={images.map(img => img.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 flex-wrap mb-4">
              {images.map(image => (
                <SortableImage
                  key={image.id}
                  id={image.id}
                  url={image.url}
                  isPrimary={image.isPrimary}
                  onSetPrimary={() => handleSetPrimary(image.id)}
                  onRemove={() => handleRemoveImage(image.id)}
                />
              ))}

              {images.length < 5 && (
                <Upload
                  customRequest={handleUpload}
                  accept="image/*"
                  showUploadList={false}
                  disabled={uploadMutation.isPending}
                >
                  <div className="w-[120px] h-[120px] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    {uploadMutation.isPending ? (
                      <Spin />
                    ) : (
                      <>
                        <PlusOutlined className="text-2xl text-gray-400" />
                        <span className="text-xs text-gray-400 mt-2">이미지 추가</span>
                      </>
                    )}
                  </div>
                </Upload>
              )}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          type="primary"
          onClick={handleSaveImages}
          loading={saveImagesMutation.isPending}
          disabled={images.length === 0}
        >
          이미지 저장
        </Button>
      </Card>
    </div>
  );
}
```

---

## 4. Mobile App Implementation

### 4.1 Shop Detail Page with Image Carousel

**File: `src/components/shop/ImageCarousel.tsx`** (New)

```tsx
'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: { id: string; url: string; isPrimary: boolean }[];
  className?: string;
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className={cn('w-full h-64 bg-gray-200 flex items-center justify-center', className)}>
        <span className="text-gray-400">이미지 없음</span>
      </div>
    );
  }

  // Sort images with primary first
  const sortedImages = [...images].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return 0;
  });

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    setTouchStart(null);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Image Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden aspect-[4/3]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out h-full"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {sortedImages.map((image, index) => (
            <div key={image.id} className="min-w-full h-full">
              <img
                src={image.url}
                alt={`Shop image ${index + 1}`}
                className="w-full h-full object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons (Desktop) */}
      {sortedImages.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors hidden md:flex"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors hidden md:flex"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Indicators */}
      {sortedImages.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {sortedImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      {sortedImages.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {currentIndex + 1} / {sortedImages.length}
        </div>
      )}
    </div>
  );
}
```

### 4.2 Shop Tags Display Component

**File: `src/components/shop/ShopTags.tsx`** (New)

```tsx
'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ShopTagsProps {
  tags: string[];
  className?: string;
  clickable?: boolean;
}

export function ShopTags({ tags, className, clickable = true }: ShopTagsProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => {
        const content = (
          <span className="text-sm text-blue-600 hover:text-blue-800">
            #{tag}
          </span>
        );

        if (clickable) {
          return (
            <Link
              key={tag}
              href={`/search?tag=${encodeURIComponent(tag)}`}
              className="hover:underline"
            >
              {content}
            </Link>
          );
        }

        return <span key={tag}>{content}</span>;
      })}
    </div>
  );
}
```

### 4.3 Shop Detail Page Update

**File: `src/app/shop/[id]/page.tsx`** (Update)

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ImageCarousel } from '@/components/shop/ImageCarousel';
import { ShopTags } from '@/components/shop/ShopTags';
import { StarRating } from '@/components/ui/star-rating';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { shopsApi } from '@/lib/api/shops-api';
import { MapPin, Phone, Clock, Heart } from 'lucide-react';

export default function ShopDetailPage() {
  const params = useParams();
  const shopId = params.id as string;

  const { data: shop, isLoading, error } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => shopsApi.getShopById(shopId),
    enabled: !!shopId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="w-full aspect-[4/3]" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">샵 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Image Carousel */}
      <ImageCarousel
        images={shop.images || []}
        className="w-full"
      />

      {/* Shop Info */}
      <div className="p-4">
        {/* Name and Rating */}
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-xl font-bold">{shop.name}</h1>
          <Button variant="ghost" size="icon" className="text-gray-400">
            <Heart className="w-6 h-6" />
          </Button>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={shop.rating || 0} size="sm" />
          <span className="text-sm text-gray-500">
            ({shop.reviewCount || 0}개 리뷰)
          </span>
        </div>

        {/* Tags */}
        <ShopTags tags={shop.tags} className="mb-4" />

        {/* Info Items */}
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{shop.address}</span>
          </div>
          {shop.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <a href={`tel:${shop.phone}`} className="text-blue-600">
                {shop.phone}
              </a>
            </div>
          )}
          {shop.operatingHours && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>{shop.operatingHours}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {shop.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-700 whitespace-pre-wrap">{shop.description}</p>
          </div>
        )}
      </div>

      {/* Booking Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button className="w-full" size="lg">
          예약하기
        </Button>
      </div>
    </div>
  );
}
```

### 4.4 Search by Tag Page

**File: `src/app/search/page.tsx`** (Update to handle tag parameter)

```tsx
// Add to existing search page

// In the component
const searchParams = useSearchParams();
const tagParam = searchParams.get('tag');

// Use tag in search query
const { data: searchResults } = useQuery({
  queryKey: ['shop-search', filters, tagParam],
  queryFn: () => tagParam
    ? shopsApi.searchByTag(tagParam, { page, limit })
    : shopsApi.search(filters),
});

// Show tag filter UI when searching by tag
{tagParam && (
  <div className="p-4 bg-blue-50 flex items-center justify-between">
    <span className="text-blue-700">#{tagParam} 검색 결과</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.push('/search')}
    >
      필터 초기화
    </Button>
  </div>
)}
```

---

## 5. Files Summary

### New Files

**Backend:**
- `src/types/shop-settings.types.ts`
- `src/migrations/005_add_shop_tags_table.sql`

**Admin Panel:**
- Updates to `src/app/dashboard/my-shop/settings/page.tsx`

**Mobile App:**
- `src/components/shop/ImageCarousel.tsx`
- `src/components/shop/ShopTags.tsx`

### Modified Files

**Backend:**
- `src/services/shop-owner/settings.service.ts`
- `src/controllers/shop-owner/settings.controller.ts`
- `src/routes/shop-owner/settings.routes.ts`
- `src/controllers/shop.controller.ts`
- `src/routes/shop.routes.ts`

**Mobile App:**
- `src/app/shop/[id]/page.tsx`
- `src/app/search/page.tsx`
- `src/lib/api/shops-api.ts`

---

## 6. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shop-owner/settings/tags` | Get shop tags |
| PUT | `/shop-owner/settings/tags` | Update shop tags |
| GET | `/shop-owner/settings/tags/popular` | Get popular tags |
| GET | `/shop-owner/settings/tags/search` | Search tags |
| GET | `/shop-owner/settings/images` | Get shop images |
| PUT | `/shop-owner/settings/images` | Update shop images |
| POST | `/shop-owner/settings/images/upload` | Upload new image |
| PATCH | `/shop-owner/settings/images/:id/primary` | Set primary image |
| GET | `/shops/:id` | Get shop details (includes tags & images) |
| GET | `/shops/tag/:tag` | Search shops by tag |

---

## 7. Testing Checklist

- [ ] Shop owner can add tags to their shop (max 10)
- [ ] Shop owner sees tag autocomplete suggestions
- [ ] Tags are validated (max 20 chars, no duplicates)
- [ ] Shop owner can upload images (max 5)
- [ ] Shop owner can reorder images via drag-drop
- [ ] Shop owner can set primary image
- [ ] Shop owner can remove images
- [ ] Mobile app displays image carousel correctly
- [ ] Image carousel supports swipe gestures
- [ ] Shop tags are displayed on shop detail page
- [ ] Clicking tag navigates to search results
- [ ] Search by tag returns correct shops
- [ ] Image carousel lazy loads non-primary images
