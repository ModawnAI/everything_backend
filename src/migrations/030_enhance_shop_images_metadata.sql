-- Migration: Enhance Shop Images Metadata
-- Description: Add advanced metadata fields to shop_images table for comprehensive image management

-- Add new metadata columns to shop_images table
ALTER TABLE public.shop_images 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS medium_url TEXT,
ADD COLUMN IF NOT EXISTS large_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_webp_url TEXT,
ADD COLUMN IF NOT EXISTS medium_webp_url TEXT,
ADD COLUMN IF NOT EXISTS large_webp_url TEXT,
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Array of tags for categorization
ADD COLUMN IF NOT EXISTS category VARCHAR(50), -- Image category (exterior, interior, service, etc.)
ADD COLUMN IF NOT EXISTS file_size BIGINT, -- Original file size in bytes
ADD COLUMN IF NOT EXISTS width INTEGER, -- Image width in pixels
ADD COLUMN IF NOT EXISTS height INTEGER, -- Image height in pixels
ADD COLUMN IF NOT EXISTS format VARCHAR(10), -- Image format (jpeg, png, webp)
ADD COLUMN IF NOT EXISTS compression_ratio DECIMAL(5,2), -- Compression ratio percentage
ADD COLUMN IF NOT EXISTS metadata JSONB, -- Additional metadata (EXIF, etc.)
ADD COLUMN IF NOT EXISTS is_optimized BOOLEAN DEFAULT FALSE, -- Whether image has been optimized
ADD COLUMN IF NOT EXISTS optimization_date TIMESTAMPTZ, -- When image was last optimized
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ, -- Last time image was accessed
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0, -- Number of times image has been accessed
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE, -- Whether image is archived
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ, -- When image was archived
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_images_category ON public.shop_images(category);
CREATE INDEX IF NOT EXISTS idx_shop_images_tags ON public.shop_images USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_shop_images_metadata ON public.shop_images USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_shop_images_optimized ON public.shop_images(is_optimized);
CREATE INDEX IF NOT EXISTS idx_shop_images_archived ON public.shop_images(is_archived);
CREATE INDEX IF NOT EXISTS idx_shop_images_updated_at ON public.shop_images(updated_at);
CREATE INDEX IF NOT EXISTS idx_shop_images_display_order ON public.shop_images(shop_id, display_order);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_shop_images_updated_at ON public.shop_images;
CREATE TRIGGER trigger_update_shop_images_updated_at
  BEFORE UPDATE ON public.shop_images
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_images_updated_at();

-- Create function to generate intelligent alt text suggestions
CREATE OR REPLACE FUNCTION generate_alt_text_suggestion(
  p_image_url TEXT,
  p_category VARCHAR(50) DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  suggestion TEXT;
  shop_name TEXT;
  service_name TEXT;
BEGIN
  -- Extract shop name from URL or get from shop table
  SELECT s.name INTO shop_name
  FROM public.shops s
  JOIN public.shop_images si ON s.id = si.shop_id
  WHERE si.image_url = p_image_url
  LIMIT 1;
  
  -- Generate suggestion based on category and tags
  IF p_category IS NOT NULL THEN
    CASE p_category
      WHEN 'exterior' THEN
        suggestion := COALESCE(shop_name, '샵') || ' 외관 사진';
      WHEN 'interior' THEN
        suggestion := COALESCE(shop_name, '샵') || ' 내부 사진';
      WHEN 'service' THEN
        suggestion := COALESCE(shop_name, '샵') || ' 서비스 사진';
      WHEN 'staff' THEN
        suggestion := COALESCE(shop_name, '샵') || ' 직원 사진';
      WHEN 'equipment' THEN
        suggestion := COALESCE(shop_name, '샵') || ' 장비 사진';
      ELSE
        suggestion := COALESCE(shop_name, '샵') || ' 이미지';
    END CASE;
  ELSE
    suggestion := COALESCE(shop_name, '샵') || ' 이미지';
  END IF;
  
  -- Add tag information if available
  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    suggestion := suggestion || ' - ' || array_to_string(p_tags, ', ');
  END IF;
  
  RETURN suggestion;
END;
$$ LANGUAGE plpgsql;

-- Create function to reorder images
CREATE OR REPLACE FUNCTION reorder_shop_images(
  p_shop_id UUID,
  p_image_orders JSONB -- Array of {id, display_order} objects
)
RETURNS BOOLEAN AS $$
DECLARE
  image_order JSONB;
BEGIN
  -- Update display_order for each image
  FOR image_order IN SELECT * FROM jsonb_array_elements(p_image_orders)
  LOOP
    UPDATE public.shop_images
    SET display_order = (image_order->>'display_order')::INTEGER,
        updated_at = NOW()
    WHERE id = (image_order->>'id')::UUID
    AND shop_id = p_shop_id;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get image statistics
CREATE OR REPLACE FUNCTION get_shop_image_stats(p_shop_id UUID)
RETURNS TABLE(
  total_images BIGINT,
  total_size BIGINT,
  avg_size DECIMAL,
  optimized_count BIGINT,
  archived_count BIGINT,
  category_stats JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_images,
    COALESCE(SUM(file_size), 0) as total_size,
    COALESCE(AVG(file_size), 0) as avg_size,
    COUNT(*) FILTER (WHERE is_optimized = TRUE) as optimized_count,
    COUNT(*) FILTER (WHERE is_archived = TRUE) as archived_count,
    jsonb_object_agg(
      COALESCE(category, 'uncategorized'), 
      category_count
    ) as category_stats
  FROM (
    SELECT 
      category,
      COUNT(*) as category_count
    FROM public.shop_images
    WHERE shop_id = p_shop_id
    GROUP BY category
  ) category_counts
  RIGHT JOIN public.shop_images si ON si.shop_id = p_shop_id
  GROUP BY si.shop_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN public.shop_images.thumbnail_url IS 'URL for thumbnail version of the image';
COMMENT ON COLUMN public.shop_images.medium_url IS 'URL for medium version of the image';
COMMENT ON COLUMN public.shop_images.large_url IS 'URL for large version of the image';
COMMENT ON COLUMN public.shop_images.thumbnail_webp_url IS 'URL for WebP thumbnail version';
COMMENT ON COLUMN public.shop_images.medium_webp_url IS 'URL for WebP medium version';
COMMENT ON COLUMN public.shop_images.large_webp_url IS 'URL for WebP large version';
COMMENT ON COLUMN public.shop_images.title IS 'Image title for display purposes';
COMMENT ON COLUMN public.shop_images.description IS 'Detailed description of the image';
COMMENT ON COLUMN public.shop_images.tags IS 'Array of tags for categorization and search';
COMMENT ON COLUMN public.shop_images.category IS 'Image category (exterior, interior, service, staff, equipment)';
COMMENT ON COLUMN public.shop_images.file_size IS 'Original file size in bytes';
COMMENT ON COLUMN public.shop_images.width IS 'Image width in pixels';
COMMENT ON COLUMN public.shop_images.height IS 'Image height in pixels';
COMMENT ON COLUMN public.shop_images.format IS 'Image format (jpeg, png, webp)';
COMMENT ON COLUMN public.shop_images.compression_ratio IS 'Compression ratio percentage';
COMMENT ON COLUMN public.shop_images.metadata IS 'Additional metadata (EXIF, color space, etc.)';
COMMENT ON COLUMN public.shop_images.is_optimized IS 'Whether image has been optimized';
COMMENT ON COLUMN public.shop_images.optimization_date IS 'When image was last optimized';
COMMENT ON COLUMN public.shop_images.last_accessed IS 'Last time image was accessed';
COMMENT ON COLUMN public.shop_images.access_count IS 'Number of times image has been accessed';
COMMENT ON COLUMN public.shop_images.is_archived IS 'Whether image is archived';
COMMENT ON COLUMN public.shop_images.archived_at IS 'When image was archived';
