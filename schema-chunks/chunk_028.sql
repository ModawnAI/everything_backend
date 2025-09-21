-- =============================================
-- SCHEMA CHUNK 28
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.8KB
-- =============================================

-- =============================================

-- Supabase Storage 버킷 설정
-- 이미지 업로드 및 관리를 위한 버킷들

-- 프로필 이미지 버킷 (공개) - v3.3 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('profile-images', 'profile-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 샵 이미지 버킷 (공개) - v3.3 업데이트 (CDN 최적화)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('shop-images', 'shop-images', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 서비스 이미지 버킷 (공개) - v3.3 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('service-images', 'service-images', true, 16777216, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 피드 이미지 버킷 (공개) - v3.2 피드 기능용
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('feed-images', 'feed-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- 사업자등록증 등 문서 버킷 (비공개) - v3.3 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('business-documents', 'business-documents', false, 52428800, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;