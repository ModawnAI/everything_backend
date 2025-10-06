-- =============================================
-- BEFORE/AFTER IMAGES TABLE
-- =============================================
-- Before and after comparison images for shop services
-- Used in service catalog to showcase service results

CREATE TABLE IF NOT EXISTS public.before_after_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
    before_image_url TEXT NOT NULL,
    after_image_url TEXT NOT NULL,
    title VARCHAR(255),
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by service_id
CREATE INDEX IF NOT EXISTS idx_before_after_images_service_id ON public.before_after_images(service_id);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_before_after_images_display_order ON public.before_after_images(display_order);

-- Enable RLS
ALTER TABLE public.before_after_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read before/after images (public catalog)
CREATE POLICY "before_after_images_select_policy" ON public.before_after_images
    FOR SELECT
    USING (true);

-- Only shop owners can manage their before/after images
CREATE POLICY "before_after_images_insert_policy" ON public.before_after_images
    FOR INSERT
    WITH CHECK (
        service_id IN (
            SELECT id FROM public.shop_services
            WHERE shop_id IN (
                SELECT id FROM public.shops WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "before_after_images_update_policy" ON public.before_after_images
    FOR UPDATE
    USING (
        service_id IN (
            SELECT id FROM public.shop_services
            WHERE shop_id IN (
                SELECT id FROM public.shops WHERE owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "before_after_images_delete_policy" ON public.before_after_images
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
CREATE OR REPLACE FUNCTION update_before_after_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_after_images_updated_at_trigger
    BEFORE UPDATE ON public.before_after_images
    FOR EACH ROW
    EXECUTE FUNCTION update_before_after_images_updated_at();

-- Comments
COMMENT ON TABLE public.before_after_images IS 'Before/after comparison images for shop services';
COMMENT ON COLUMN public.before_after_images.before_image_url IS 'URL to the before image';
COMMENT ON COLUMN public.before_after_images.after_image_url IS 'URL to the after image';
