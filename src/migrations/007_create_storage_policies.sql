-- Migration: 007_create_storage_policies.sql
-- Description: Create Supabase Storage policies for access control
-- Author: Task Master AI
-- Created: 2025-07-28

-- =============================================
-- STORAGE BUCKETS CREATION
-- =============================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('shop-images', 'shop-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('service-images', 'service-images', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('business-documents', 'business-documents', false, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STORAGE POLICIES
-- =============================================

-- Profile Images Policies
-- Users can manage their own profile images
CREATE POLICY IF NOT EXISTS "profile_images_own" ON storage.objects
FOR ALL USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Public can read profile images
CREATE POLICY IF NOT EXISTS "profile_images_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profile-images'
);

-- Shop Images Policies
-- Shop owners can manage their shop images
CREATE POLICY IF NOT EXISTS "shop_images_owner_manage" ON storage.objects
FOR ALL USING (
  bucket_id = 'shop-images'
  AND EXISTS (
    SELECT 1 FROM public.shops 
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Public can read active shop images
CREATE POLICY IF NOT EXISTS "shop_images_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'shop-images'
  AND EXISTS (
    SELECT 1 FROM public.shops 
    WHERE id::text = (storage.foldername(name))[1]
    AND shop_status = 'active'
  )
);

-- Service Images Policies
-- Shop owners can manage their service images
CREATE POLICY IF NOT EXISTS "service_images_owner_manage" ON storage.objects
FOR ALL USING (
  bucket_id = 'service-images'
  AND EXISTS (
    SELECT 1 FROM public.shop_services ss
    JOIN public.shops s ON s.id = ss.shop_id
    WHERE ss.id::text = (storage.foldername(name))[1]
    AND s.owner_id = auth.uid()
  )
);

-- Public can read available service images
CREATE POLICY IF NOT EXISTS "service_images_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'service-images'
  AND EXISTS (
    SELECT 1 FROM public.shop_services ss
    JOIN public.shops s ON s.id = ss.shop_id
    WHERE ss.id::text = (storage.foldername(name))[1]
    AND s.shop_status = 'active'
    AND ss.is_available = true
  )
);

-- Business Documents Policies
-- Users can manage their own business documents
CREATE POLICY IF NOT EXISTS "business_documents_owner" ON storage.objects
FOR ALL USING (
  bucket_id = 'business-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can access all business documents
CREATE POLICY IF NOT EXISTS "business_documents_admin" ON storage.objects
FOR ALL USING (
  bucket_id = 'business-documents'
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND user_role = 'admin'
  )
);

-- =============================================
-- STORAGE TRIGGERS FOR CLEANUP
-- =============================================

-- Function to log file operations for cleanup tracking
CREATE OR REPLACE FUNCTION log_storage_operation()
RETURNS TRIGGER AS $$
BEGIN
  -- Log file creation for cleanup tracking
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.storage_logs (
      bucket_id,
      file_path,
      operation,
      user_id,
      created_at
    ) VALUES (
      NEW.bucket_id,
      NEW.name,
      'INSERT',
      auth.uid(),
      NOW()
    );
    RETURN NEW;
  END IF;

  -- Log file deletion for cleanup tracking
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.storage_logs (
      bucket_id,
      file_path,
      operation,
      user_id,
      created_at
    ) VALUES (
      OLD.bucket_id,
      OLD.name,
      'DELETE',
      auth.uid(),
      NOW()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.storage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'DELETE')),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_storage_logs_bucket_path ON public.storage_logs(bucket_id, file_path);
CREATE INDEX IF NOT EXISTS idx_storage_logs_created_at ON public.storage_logs(created_at);

-- Enable RLS on storage_logs
ALTER TABLE public.storage_logs ENABLE ROW LEVEL SECURITY;

-- Storage logs policies - only admins can view
CREATE POLICY IF NOT EXISTS "storage_logs_admin_read" ON public.storage_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND user_role = 'admin'
  )
);

-- Create trigger for storage operations logging
DROP TRIGGER IF EXISTS storage_operation_trigger ON storage.objects;
CREATE TRIGGER storage_operation_trigger
  AFTER INSERT OR DELETE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION log_storage_operation();

-- =============================================
-- STORAGE CLEANUP FUNCTION
-- =============================================

-- Function to clean up orphaned files
CREATE OR REPLACE FUNCTION cleanup_orphaned_files(dry_run BOOLEAN DEFAULT true)
RETURNS TABLE (
  bucket_id TEXT,
  file_path TEXT,
  action TEXT,
  reason TEXT
) AS $$
DECLARE
  orphaned_file RECORD;
  file_age INTERVAL;
BEGIN
  -- Check for orphaned profile images (not referenced in users table)
  FOR orphaned_file IN
    SELECT o.bucket_id, o.name as file_path
    FROM storage.objects o
    WHERE o.bucket_id = 'profile-images'
    AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.profile_image_url LIKE '%' || o.name || '%'
    )
  LOOP
    file_age := NOW() - orphaned_file.created_at;
    
    -- Only delete files older than 7 days
    IF file_age > INTERVAL '7 days' THEN
      IF NOT dry_run THEN
        DELETE FROM storage.objects 
        WHERE bucket_id = orphaned_file.bucket_id 
        AND name = orphaned_file.file_path;
      END IF;
      
      RETURN QUERY SELECT 
        orphaned_file.bucket_id,
        orphaned_file.file_path,
        CASE WHEN dry_run THEN 'WOULD_DELETE' ELSE 'DELETED' END,
        'Orphaned profile image';
    END IF;
  END LOOP;

  -- Check for orphaned shop images (not referenced in shop_images table)
  FOR orphaned_file IN
    SELECT o.bucket_id, o.name as file_path
    FROM storage.objects o
    WHERE o.bucket_id = 'shop-images'
    AND NOT EXISTS (
      SELECT 1 FROM public.shop_images si
      WHERE si.image_url LIKE '%' || o.name || '%'
    )
  LOOP
    file_age := NOW() - orphaned_file.created_at;
    
    -- Only delete files older than 30 days
    IF file_age > INTERVAL '30 days' THEN
      IF NOT dry_run THEN
        DELETE FROM storage.objects 
        WHERE bucket_id = orphaned_file.bucket_id 
        AND name = orphaned_file.file_path;
      END IF;
      
      RETURN QUERY SELECT 
        orphaned_file.bucket_id,
        orphaned_file.file_path,
        CASE WHEN dry_run THEN 'WOULD_DELETE' ELSE 'DELETED' END,
        'Orphaned shop image';
    END IF;
  END LOOP;

  -- Check for orphaned service images (not referenced in service_images table)
  FOR orphaned_file IN
    SELECT o.bucket_id, o.name as file_path
    FROM storage.objects o
    WHERE o.bucket_id = 'service-images'
    AND NOT EXISTS (
      SELECT 1 FROM public.service_images si
      WHERE si.image_url LIKE '%' || o.name || '%'
    )
  LOOP
    file_age := NOW() - orphaned_file.created_at;
    
    -- Only delete files older than 30 days
    IF file_age > INTERVAL '30 days' THEN
      IF NOT dry_run THEN
        DELETE FROM storage.objects 
        WHERE bucket_id = orphaned_file.bucket_id 
        AND name = orphaned_file.file_path;
      END IF;
      
      RETURN QUERY SELECT 
        orphaned_file.bucket_id,
        orphaned_file.file_path,
        CASE WHEN dry_run THEN 'WOULD_DELETE' ELSE 'DELETED' END,
        'Orphaned service image';
    END IF;
  END LOOP;

  -- Check for old business documents (older than 90 days)
  FOR orphaned_file IN
    SELECT o.bucket_id, o.name as file_path
    FROM storage.objects o
    WHERE o.bucket_id = 'business-documents'
    AND o.created_at < NOW() - INTERVAL '90 days'
  LOOP
    IF NOT dry_run THEN
      DELETE FROM storage.objects 
      WHERE bucket_id = orphaned_file.bucket_id 
      AND name = orphaned_file.file_path;
    END IF;
    
    RETURN QUERY SELECT 
      orphaned_file.bucket_id,
      orphaned_file.file_path,
      CASE WHEN dry_run THEN 'WOULD_DELETE' ELSE 'DELETED' END,
      'Old business document';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_orphaned_files(BOOLEAN) TO authenticated;

-- =============================================
-- STORAGE STATISTICS FUNCTION
-- =============================================

-- Function to get storage statistics
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
  bucket_id TEXT,
  file_count BIGINT,
  total_size BIGINT,
  avg_file_size BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.bucket_id,
    COUNT(*) as file_count,
    COALESCE(SUM(o.metadata->>'size')::BIGINT, 0) as total_size,
    COALESCE(AVG(o.metadata->>'size')::BIGINT, 0) as avg_file_size
  FROM storage.objects o
  GROUP BY o.bucket_id
  ORDER BY o.bucket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_storage_stats() TO authenticated;

-- Add comments for documentation
COMMENT ON POLICY "profile_images_own" ON storage.objects IS 'Users can manage their own profile images';
COMMENT ON POLICY "shop_images_owner_manage" ON storage.objects IS 'Shop owners can manage their shop images';
COMMENT ON POLICY "business_documents_admin" ON storage.objects IS 'Admins can access all business documents';
COMMENT ON FUNCTION cleanup_orphaned_files(BOOLEAN) IS 'Clean up orphaned files from storage buckets';
COMMENT ON FUNCTION get_storage_stats() IS 'Get storage statistics for all buckets'; 