-- =============================================
-- SCHEMA CHUNK 32
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.6KB
-- =============================================

-- =============================================

-- CDN 샵 이미지 정책
CREATE POLICY "cdn_shop_images_owner_manage" ON storage.objects
    FOR ALL USING (
        bucket_id = 'shop-images-cdn'
        AND EXISTS (
            SELECT 1 FROM public.shops 
            WHERE owner_id = auth.uid() 
            AND id::text = (storage.foldername(storage.objects.name))[1]
        )
    );

CREATE POLICY "cdn_shop_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'shop-images-cdn');

-- CDN 프로필 이미지 정책
CREATE POLICY "cdn_profile_images_own" ON storage.objects
    FOR ALL USING (
        bucket_id = 'profile-images-cdn' 
        AND auth.uid()::text = (storage.foldername(storage.objects.name))[1]
    );

CREATE POLICY "cdn_profile_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images-cdn');

-- CDN 서비스 이미지 정책
CREATE POLICY "cdn_service_images_owner_manage" ON storage.objects
    FOR ALL USING (
        bucket_id = 'service-images-cdn'
        AND EXISTS (
            SELECT 1 FROM public.shops s
            JOIN public.shop_services ss ON s.id = ss.shop_id
            WHERE s.owner_id = auth.uid() 
            AND ss.id::text = (storage.foldername(storage.objects.name))[1]
        )
    );

CREATE POLICY "cdn_service_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'service-images-cdn');

-- 이미지 캐시 정책 (시스템 관리)
CREATE POLICY "image_cache_system_manage" ON storage.objects
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