-- Simple spatial indexes creation script
-- Focus on core index creation without complex PL/pgSQL

-- Drop existing basic indexes if they exist to recreate with better performance
DROP INDEX IF EXISTS public.idx_shops_category;
DROP INDEX IF EXISTS public.idx_shops_status;
DROP INDEX IF EXISTS public.idx_shops_type;

-- Primary composite spatial index for active shops by category and location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_active_category_location 
ON public.shops USING GIST (location, main_category) 
WHERE shop_status = 'active' AND location IS NOT NULL;

-- Composite index for shop type priority sorting with location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_status_location 
ON public.shops USING GIST (location, shop_type) 
WHERE shop_status = 'active' AND location IS NOT NULL;

-- Comprehensive composite index for complex filtering scenarios
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_category_status_location 
ON public.shops USING GIST (location, main_category, shop_status) 
WHERE location IS NOT NULL;

-- Specialized index for featured shop queries with location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_featured_location 
ON public.shops USING GIST (location) 
WHERE is_featured = true 
  AND featured_until > NOW() 
  AND shop_status = 'active' 
  AND location IS NOT NULL;

-- Recreate optimized B-tree indexes for non-spatial columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_category_active 
ON public.shops (main_category) 
WHERE shop_status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_active 
ON public.shops (shop_type) 
WHERE shop_status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_status_btree 
ON public.shops (shop_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_featured_time 
ON public.shops (is_featured, featured_until) 
WHERE shop_status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_category_active 
ON public.shops (shop_type, main_category) 
WHERE shop_status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_owner_status 
ON public.shops (owner_id, shop_status);

-- Update table statistics
ANALYZE public.shops;

