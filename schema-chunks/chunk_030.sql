-- =============================================
-- SCHEMA CHUNK 30
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 2.7KB
-- =============================================

-- =============================================

-- CDN 샵 이미지 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('shop-images-cdn', 'shop-images-cdn', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- CDN 프로필 이미지 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('profile-images-cdn', 'profile-images-cdn', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- CDN 서비스 이미지 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('service-images-cdn', 'service-images-cdn', true, 16777216, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 이미지 캐시 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('image-cache', 'image-cache', true, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS 정책 설정
-- 프로필 이미지: 소유자만 업로드, 모든 사용자 조회 가능
CREATE POLICY "Users can upload own profile images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Profile images are publicly viewable" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

-- 샵 이미지: 샵 소유자만 업로드
CREATE POLICY "Shop owners can upload shop images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'shop-images' AND 
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE owner_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    );

-- 피드 이미지: 인증된 사용자만 업로드
CREATE POLICY "Authenticated users can upload feed images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'feed-images' AND auth.uid() IS NOT NULL);

-- 사업자 문서: 해당 샵 소유자만 업로드/조회
CREATE POLICY "Shop owners can manage business documents" ON storage.objects
    FOR ALL USING (
        bucket_id = 'business-documents' AND 
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE owner_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    );