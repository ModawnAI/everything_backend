-- =============================================
-- SERVICE VIDEOS TABLE
-- =============================================
-- Video content for shop services
-- Used in service catalog to display promotional videos

CREATE TABLE IF NOT EXISTS public.service_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    title VARCHAR(255),
    description TEXT,
    duration_seconds INTEGER,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by service_id
CREATE INDEX IF NOT EXISTS idx_service_videos_service_id ON public.service_videos(service_id);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_service_videos_display_order ON public.service_videos(display_order);

-- Enable RLS
ALTER TABLE public.service_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read service videos (public catalog)
CREATE POLICY "service_videos_select_policy" ON public.service_videos
    FOR SELECT
    USING (true);

-- Only shop owners can manage their service videos
CREATE POLICY "service_videos_insert_policy" ON public.service_videos
    FOR INSERT
    WITH CHECK (
        service_id IN (
            SELECT id FROM public.shop_services
            WHERE shop_id IN (
                SELECT id FROM public.shops WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "service_videos_update_policy" ON public.service_videos
    FOR UPDATE
    USING (
        service_id IN (
            SELECT id FROM public.shop_services
            WHERE shop_id IN (
                SELECT id FROM public.shops WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "service_videos_delete_policy" ON public.service_videos
    FOR DELETE
    USING (
        service_id IN (
            SELECT id FROM public.shop_services
            WHERE shop_id IN (
                SELECT id FROM public.shops WHERE owner_id = auth.uid()
            )
        )
    );

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_service_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_videos_updated_at_trigger
    BEFORE UPDATE ON public.service_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_service_videos_updated_at();

-- Comments
COMMENT ON TABLE public.service_videos IS 'Video content for shop services, used in service catalog';
COMMENT ON COLUMN public.service_videos.video_url IS 'URL to the video file in storage';
COMMENT ON COLUMN public.service_videos.thumbnail_url IS 'URL to video thumbnail image';
COMMENT ON COLUMN public.service_videos.duration_seconds IS 'Video duration in seconds';
