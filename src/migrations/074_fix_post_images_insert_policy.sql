-- =============================================
-- Fix post_images INSERT policy
-- =============================================
-- Add INSERT policy for post_images table to allow authenticated users
-- to add images to feed posts
-- Generated: 2025-10-24
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can add images to own posts" ON public.post_images;
DROP POLICY IF EXISTS "Users can manage images for own posts" ON public.post_images;

-- Create INSERT policy: Users can add images to their own posts
CREATE POLICY "Users can manage images for own posts" ON public.post_images FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts
    WHERE id = post_images.post_id
    AND author_id = auth.uid()
  )
);

-- =============================================
-- Migration completed successfully
-- =============================================
