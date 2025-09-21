-- Migration: 038_enhance_storage_for_cdn_integration.sql
-- Description: Enhance Supabase Storage configuration for CDN integration
-- Author: Task Master AI
-- Created: 2025-01-27

-- =============================================
-- ENHANCED STORAGE BUCKETS FOR CDN INTEGRATION
-- =============================================

-- Update existing buckets with CDN-optimized settings
UPDATE storage.buckets 
SET 
  file_size_limit = CASE 
    WHEN id = 'profile-images' THEN 10485760  -- 10MB for profile images
    WHEN id = 'shop-images' THEN 20971520     -- 20MB for shop images (higher for CDN processing)
    WHEN id = 'service-images' THEN 16777216  -- 16MB for service images
    WHEN id = 'business-documents' THEN 52428800 -- 50MB for business documents
    ELSE file_size_limit
  END,
  allowed_mime_types = CASE 
    WHEN id = 'shop-images' THEN ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']
    WHEN id = 'profile-images' THEN ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    WHEN id = 'service-images' THEN ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    ELSE allowed_mime_types
  END
WHERE id IN ('profile-images', 'shop-images', 'service-images', 'business-documents');

-- Create CDN-specific buckets for optimized image delivery
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('shop-images-cdn', 'shop-images-cdn', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('profile-images-cdn', 'profile-images-cdn', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('service-images-cdn', 'service-images-cdn', true, 16777216, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create a cache bucket for transformed images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('image-cache', 'image-cache', true, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- ENHANCED STORAGE POLICIES FOR CDN BUCKETS
-- =============================================

-- CDN Shop Images Policies
CREATE POLICY IF NOT EXISTS "cdn_shop_images_owner_manage" ON storage.objects
FOR ALL USING (
  bucket_id = 'shop-images-cdn'
  AND EXISTS (
    SELECT 1 FROM public.shops 
    WHERE owner_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY IF NOT EXISTS "cdn_shop_images_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'shop-images-cdn'
);

-- CDN Profile Images Policies
CREATE POLICY IF NOT EXISTS "cdn_profile_images_own" ON storage.objects
FOR ALL USING (
  bucket_id = 'profile-images-cdn' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "cdn_profile_images_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profile-images-cdn'
);

-- CDN Service Images Policies
CREATE POLICY IF NOT EXISTS "cdn_service_images_owner_manage" ON storage.objects
FOR ALL USING (
  bucket_id = 'service-images-cdn'
  AND EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.shop_services ss ON s.id = ss.shop_id
    WHERE s.owner_id = auth.uid() 
    AND ss.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY IF NOT EXISTS "cdn_service_images_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'service-images-cdn'
);

-- Image Cache Policies (System-managed)
CREATE POLICY IF NOT EXISTS "image_cache_system_manage" ON storage.objects
FOR ALL USING (
  bucket_id = 'image-cache'
  AND (
    -- System can manage cache
    auth.uid() IS NOT NULL
    OR
    -- Public read access for cached images
    TRUE
  )
);

-- =============================================
-- STORAGE METADATA EXTENSIONS
-- =============================================

-- Add metadata columns to storage.objects for CDN tracking
ALTER TABLE storage.objects 
ADD COLUMN IF NOT EXISTS cdn_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cdn_transformations JSONB,
ADD COLUMN IF NOT EXISTS original_file_id UUID REFERENCES storage.objects(id),
ADD COLUMN IF NOT EXISTS cache_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for CDN performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_cdn_processed 
ON storage.objects(bucket_id, cdn_processed) 
WHERE cdn_processed = TRUE;

CREATE INDEX IF NOT EXISTS idx_storage_objects_cache_expires 
ON storage.objects(bucket_id, cache_expires_at) 
WHERE cache_expires_at IS NOT NULL;

-- =============================================
-- CDN CONFIGURATION TABLE
-- =============================================

-- Create CDN configuration table
CREATE TABLE IF NOT EXISTS public.cdn_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id),
  transformation_preset TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for CDN configurations
ALTER TABLE public.cdn_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdn_configurations_admin_manage" ON public.cdn_configurations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "cdn_configurations_public_read" ON public.cdn_configurations
FOR SELECT USING (is_active = TRUE);

-- Create indexes for CDN configurations
CREATE INDEX IF NOT EXISTS idx_cdn_configurations_bucket_preset 
ON public.cdn_configurations(bucket_id, transformation_preset, is_active);

-- =============================================
-- DEFAULT CDN TRANSFORMATION PRESETS
-- =============================================

-- Insert default CDN transformation presets
INSERT INTO public.cdn_configurations (bucket_id, transformation_preset, config) VALUES
-- Shop Images Presets
('shop-images-cdn', 'thumbnail', '{
  "width": 200,
  "height": 200,
  "fit": "cover",
  "quality": 85,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

('shop-images-cdn', 'small', '{
  "width": 400,
  "height": 300,
  "fit": "cover",
  "quality": 85,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

('shop-images-cdn', 'medium', '{
  "width": 800,
  "height": 600,
  "fit": "cover",
  "quality": 90,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

('shop-images-cdn', 'large', '{
  "width": 1200,
  "height": 900,
  "fit": "cover",
  "quality": 95,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

('shop-images-cdn', 'original', '{
  "quality": 95,
  "format": "auto",
  "progressive": true,
  "stripMetadata": false
}'),

-- Profile Images Presets
('profile-images-cdn', 'avatar', '{
  "width": 150,
  "height": 150,
  "fit": "cover",
  "quality": 90,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

('profile-images-cdn', 'profile', '{
  "width": 300,
  "height": 300,
  "fit": "cover",
  "quality": 90,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

-- Service Images Presets
('service-images-cdn', 'service-thumb', '{
  "width": 300,
  "height": 200,
  "fit": "cover",
  "quality": 85,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}'),

('service-images-cdn', 'service-large', '{
  "width": 800,
  "height": 600,
  "fit": "cover",
  "quality": 90,
  "format": "webp",
  "progressive": true,
  "stripMetadata": true
}');

-- =============================================
-- CDN PERFORMANCE FUNCTIONS
-- =============================================

-- Function to get CDN URL with transformations
CREATE OR REPLACE FUNCTION public.get_cdn_url(
  bucket_name TEXT,
  file_path TEXT,
  preset TEXT DEFAULT 'original'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url TEXT;
  cdn_config JSONB;
  transform_params TEXT := '';
BEGIN
  -- Get base URL from environment or use default
  base_url := current_setting('app.supabase_url', true);
  IF base_url IS NULL THEN
    base_url := 'https://your-project.supabase.co';
  END IF;
  
  -- Get transformation configuration
  SELECT config INTO cdn_config
  FROM public.cdn_configurations
  WHERE bucket_id = bucket_name || '-cdn'
    AND transformation_preset = preset
    AND is_active = TRUE;
  
  -- Build transformation parameters if config exists
  IF cdn_config IS NOT NULL THEN
    IF cdn_config->>'width' IS NOT NULL THEN
      transform_params := transform_params || '&width=' || (cdn_config->>'width');
    END IF;
    
    IF cdn_config->>'height' IS NOT NULL THEN
      transform_params := transform_params || '&height=' || (cdn_config->>'height');
    END IF;
    
    IF cdn_config->>'quality' IS NOT NULL THEN
      transform_params := transform_params || '&quality=' || (cdn_config->>'quality');
    END IF;
    
    IF cdn_config->>'format' IS NOT NULL THEN
      transform_params := transform_params || '&format=' || (cdn_config->>'format');
    END IF;
    
    IF cdn_config->>'fit' IS NOT NULL THEN
      transform_params := transform_params || '&fit=' || (cdn_config->>'fit');
    END IF;
    
    IF (cdn_config->>'progressive')::boolean = TRUE THEN
      transform_params := transform_params || '&progressive=true';
    END IF;
    
    IF (cdn_config->>'stripMetadata')::boolean = TRUE THEN
      transform_params := transform_params || '&stripMetadata=true';
    END IF;
    
    -- Remove leading & and add ?
    IF length(transform_params) > 0 THEN
      transform_params := '?' || substring(transform_params from 2);
    END IF;
  END IF;
  
  -- Return CDN URL
  RETURN base_url || '/storage/v1/object/public/' || bucket_name || '-cdn/' || file_path || transform_params;
END;
$$;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.clean_expired_cdn_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete expired cache entries
  WITH deleted AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'image-cache'
      AND cache_expires_at IS NOT NULL
      AND cache_expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Log cleanup activity
  INSERT INTO public.system_logs (level, message, metadata)
  VALUES ('info', 'CDN cache cleanup completed', 
    json_build_object('deleted_count', deleted_count, 'timestamp', NOW()));
  
  RETURN deleted_count;
END;
$$;

-- =============================================
-- CDN CACHE MANAGEMENT
-- =============================================

-- Create a view for CDN cache statistics
CREATE OR REPLACE VIEW public.cdn_cache_stats AS
SELECT 
  bucket_id,
  COUNT(*) as total_files,
  COUNT(*) FILTER (WHERE cdn_processed = TRUE) as processed_files,
  COUNT(*) FILTER (WHERE cache_expires_at < NOW()) as expired_files,
  SUM(metadata->>'size')::BIGINT as total_size_bytes,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
FROM storage.objects
WHERE bucket_id LIKE '%-cdn' OR bucket_id = 'image-cache'
GROUP BY bucket_id;

-- Grant access to the view
GRANT SELECT ON public.cdn_cache_stats TO authenticated;

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.cdn_configurations IS 'CDN transformation presets for different image sizes and qualities';
COMMENT ON FUNCTION public.get_cdn_url IS 'Generate CDN URLs with transformation parameters';
COMMENT ON FUNCTION public.clean_expired_cdn_cache IS 'Clean up expired CDN cache entries';
COMMENT ON VIEW public.cdn_cache_stats IS 'Statistics about CDN cache usage and performance';

-- =============================================
-- COMPLETION LOG
-- =============================================

INSERT INTO public.migration_log (migration_name, applied_at, description)
VALUES (
  '038_enhance_storage_for_cdn_integration',
  NOW(),
  'Enhanced Supabase Storage configuration for CDN integration with optimized buckets, policies, and transformation presets'
);
