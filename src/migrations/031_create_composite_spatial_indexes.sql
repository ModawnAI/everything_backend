-- Migration: 031_create_composite_spatial_indexes.sql
-- Description: Create composite spatial indexes for optimized category+location queries
-- Author: Task Master AI - Phase 3 Shop System
-- Created: 2025-01-19
-- Task: #1.2 - Create Composite Spatial Indexes for Category+Location Queries

-- =============================================
-- COMPOSITE SPATIAL INDEXES FOR PERFORMANCE
-- =============================================

-- Drop existing basic indexes if they exist to recreate with better performance
-- (We'll recreate them as composite indexes)
DROP INDEX IF EXISTS public.idx_shops_category;
DROP INDEX IF EXISTS public.idx_shops_status;
DROP INDEX IF EXISTS public.idx_shops_type;

-- =============================================
-- PRIMARY COMPOSITE SPATIAL INDEX
-- =============================================

-- Composite index for the most common query pattern: active shops by category and location
-- This optimizes queries like: "Find active nail salons within 5km"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_active_category_location 
ON public.shops USING GIST (
    location,
    main_category
) 
WHERE shop_status = 'active' AND location IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX public.idx_shops_active_category_location IS 
'Composite spatial index for active shops filtered by category and location - optimizes nearby shop searches';

-- =============================================
-- SHOP TYPE + LOCATION COMPOSITE INDEX
-- =============================================

-- Composite index for partnered/non-partnered shop queries with location
-- This optimizes the priority sorting: partnered shops first, then by distance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_status_location 
ON public.shops USING GIST (
    location,
    shop_type
) 
WHERE shop_status = 'active' AND location IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX public.idx_shops_type_status_location IS 
'Composite spatial index for shop type priority sorting with location filtering';

-- =============================================
-- CATEGORY + STATUS + LOCATION INDEX
-- =============================================

-- Comprehensive composite index for complex filtering scenarios
-- Supports queries with multiple filters: category, status, and location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_category_status_location 
ON public.shops USING GIST (
    location,
    main_category,
    shop_status
) 
WHERE location IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX public.idx_shops_category_status_location IS 
'Comprehensive composite spatial index supporting category, status, and location filters';

-- =============================================
-- FEATURED SHOPS SPATIAL INDEX
-- =============================================

-- Specialized index for featured shop queries with location
-- Optimizes queries for promoted/featured shops in specific areas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_featured_location 
ON public.shops USING GIST (
    location
) 
WHERE is_featured = true 
  AND featured_until > NOW() 
  AND shop_status = 'active' 
  AND location IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX public.idx_shops_featured_location IS 
'Spatial index for currently featured and active shops with location data';

-- =============================================
-- BTREE INDEXES FOR NON-SPATIAL FILTERING
-- =============================================

-- Recreate optimized B-tree indexes for non-spatial columns used in WHERE clauses
-- These work in combination with the spatial indexes above

-- Category index with status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_category_active 
ON public.shops (main_category) 
WHERE shop_status = 'active';

-- Shop type index with status filter  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_active 
ON public.shops (shop_type) 
WHERE shop_status = 'active';

-- Status index for general queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_status_btree 
ON public.shops (shop_status);

-- Featured shops index for time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_featured_time 
ON public.shops (is_featured, featured_until) 
WHERE shop_status = 'active';

-- =============================================
-- MULTI-COLUMN BTREE INDEXES
-- =============================================

-- Composite B-tree index for shop type and category filtering
-- Supports queries that filter by both shop type and category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_category_active 
ON public.shops (shop_type, main_category) 
WHERE shop_status = 'active';

-- Composite index for owner queries with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_owner_status 
ON public.shops (owner_id, shop_status);

-- =============================================
-- ANALYZE TABLES FOR UPDATED STATISTICS
-- =============================================

-- Update table statistics after creating new indexes
ANALYZE public.shops;

-- =============================================
-- VERIFY INDEX CREATION
-- =============================================

-- Log successful index creation
DO $$
DECLARE
    index_count INTEGER;
    spatial_index_count INTEGER;
BEGIN
    -- Count total indexes on shops table
    SELECT COUNT(*) FROM pg_indexes 
    WHERE tablename = 'shops' 
    INTO index_count;
    
    -- Count spatial (GIST) indexes specifically
    SELECT COUNT(*) FROM pg_indexes 
    WHERE tablename = 'shops' 
      AND indexdef LIKE '%USING gist%'
    INTO spatial_index_count;
    
    RAISE NOTICE 'Index creation completed:';
    RAISE NOTICE '  Total indexes on shops table: %', index_count;
    RAISE NOTICE '  Spatial (GIST) indexes: %', spatial_index_count;
    RAISE NOTICE '  Migration 031_create_composite_spatial_indexes.sql completed at %', NOW();
END $$;

-- =============================================
-- PERFORMANCE MONITORING SETUP
-- =============================================

-- Create a function to monitor spatial query performance
CREATE OR REPLACE FUNCTION public.get_spatial_index_usage()
RETURNS TABLE (
    index_name TEXT,
    table_name TEXT,
    index_scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    avg_tuples_per_scan NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.indexrelname::TEXT as index_name,
        t.relname::TEXT as table_name,
        s.idx_scan as index_scans,
        s.idx_tup_read as tuples_read,
        s.idx_tup_fetch as tuples_fetched,
        CASE 
            WHEN s.idx_scan > 0 THEN ROUND(s.idx_tup_read::NUMERIC / s.idx_scan, 2)
            ELSE 0 
        END as avg_tuples_per_scan
    FROM pg_stat_user_indexes s
    JOIN pg_class i ON i.oid = s.indexrelid
    JOIN pg_class t ON t.oid = s.relid
    WHERE t.relname = 'shops'
      AND (i.indexrelname LIKE '%location%' OR i.indexrelname LIKE '%spatial%')
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the monitoring function
COMMENT ON FUNCTION public.get_spatial_index_usage() IS 
'Monitor usage statistics for spatial indexes on the shops table';

-- =============================================
-- COMPLETION VERIFICATION
-- =============================================

-- Final verification that all expected indexes exist
DO $$
DECLARE
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    expected_indexes TEXT[] := ARRAY[
        'idx_shops_active_category_location',
        'idx_shops_type_status_location', 
        'idx_shops_category_status_location',
        'idx_shops_featured_location',
        'idx_shops_category_active',
        'idx_shops_type_active',
        'idx_shops_status_btree',
        'idx_shops_featured_time',
        'idx_shops_type_category_active',
        'idx_shops_owner_status'
    ];
    idx TEXT;
BEGIN
    -- Check each expected index
    FOREACH idx IN ARRAY expected_indexes
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'shops' AND indexname = idx
        ) THEN
            missing_indexes := array_append(missing_indexes, idx);
        END IF;
    END LOOP;
    
    -- Report results
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE WARNING 'Missing indexes: %', array_to_string(missing_indexes, ', ');
    ELSE
        RAISE NOTICE 'All composite spatial indexes created successfully!';
    END IF;
END $$;
