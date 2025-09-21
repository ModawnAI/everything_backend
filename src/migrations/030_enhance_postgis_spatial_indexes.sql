-- Migration: 029_enhance_postgis_spatial_indexes.sql
-- Description: Enhance PostGIS spatial indexes for optimized location-based queries
-- Author: Task Master AI - Phase 3 Shop System
-- Created: 2025-01-19
-- Task: #1.1 - Verify and Configure PostGIS Extension Status

-- =============================================
-- VERIFY POSTGIS EXTENSION STATUS
-- =============================================

-- Check if PostGIS extensions are properly installed
DO $$
BEGIN
    -- Verify PostGIS extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        RAISE EXCEPTION 'PostGIS extension is not installed. Please install it first.';
    END IF;
    
    -- Verify PostGIS topology extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis_topology') THEN
        RAISE NOTICE 'PostGIS topology extension is not installed. Installing now...';
        CREATE EXTENSION IF NOT EXISTS "postgis_topology";
    END IF;
    
    -- Verify PostGIS raster extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis_raster') THEN
        RAISE NOTICE 'PostGIS raster extension is not installed. Installing now...';
        CREATE EXTENSION IF NOT EXISTS "postgis_raster";
    END IF;
    
    RAISE NOTICE 'PostGIS extensions verification completed successfully.';
END $$;

-- =============================================
-- VERIFY SPATIAL REFERENCE SYSTEM
-- =============================================

-- Ensure WGS84 (SRID 4326) is available for geographic coordinates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM spatial_ref_sys WHERE srid = 4326) THEN
        RAISE EXCEPTION 'WGS84 (SRID 4326) spatial reference system is not available.';
    END IF;
    
    RAISE NOTICE 'Spatial reference system WGS84 (SRID 4326) verified successfully.';
END $$;

-- =============================================
-- ANALYZE EXISTING SPATIAL DATA
-- =============================================

-- Check existing spatial index performance
DO $$
DECLARE
    index_exists BOOLEAN;
    table_count INTEGER;
    spatial_count INTEGER;
BEGIN
    -- Check if basic spatial index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shops' 
        AND indexname = 'idx_shops_location'
    ) INTO index_exists;
    
    IF NOT index_exists THEN
        RAISE EXCEPTION 'Basic spatial index idx_shops_location does not exist on shops table.';
    END IF;
    
    -- Get table statistics
    SELECT COUNT(*) FROM public.shops INTO table_count;
    SELECT COUNT(*) FROM public.shops WHERE location IS NOT NULL INTO spatial_count;
    
    RAISE NOTICE 'Spatial data analysis: % total shops, % with location data (%.1f%%)', 
        table_count, spatial_count, 
        CASE WHEN table_count > 0 THEN (spatial_count::FLOAT / table_count * 100) ELSE 0 END;
END $$;

-- =============================================
-- VERIFY LOCATION DATA INTEGRITY
-- =============================================

-- Check for and report any data integrity issues
DO $$
DECLARE
    invalid_coords INTEGER;
    missing_geography INTEGER;
    coord_mismatch INTEGER;
BEGIN
    -- Check for invalid latitude/longitude coordinates
    SELECT COUNT(*) FROM public.shops 
    WHERE (latitude IS NOT NULL AND (latitude < -90 OR latitude > 90))
       OR (longitude IS NOT NULL AND (longitude < -180 OR longitude > 180))
    INTO invalid_coords;
    
    -- Check for missing geography when coordinates exist
    SELECT COUNT(*) FROM public.shops 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL
    INTO missing_geography;
    
    -- Check for coordinate/geography mismatches
    SELECT COUNT(*) FROM public.shops 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NOT NULL
      AND ABS(ST_Y(location::geometry) - latitude) > 0.0001
      AND ABS(ST_X(location::geometry) - longitude) > 0.0001
    INTO coord_mismatch;
    
    IF invalid_coords > 0 THEN
        RAISE WARNING 'Found % shops with invalid coordinates (lat/lng out of range)', invalid_coords;
    END IF;
    
    IF missing_geography > 0 THEN
        RAISE WARNING 'Found % shops with coordinates but missing PostGIS geography data', missing_geography;
    END IF;
    
    IF coord_mismatch > 0 THEN
        RAISE WARNING 'Found % shops with coordinate/geography data mismatches', coord_mismatch;
    END IF;
    
    RAISE NOTICE 'Location data integrity check completed.';
END $$;

-- =============================================
-- UPDATE STATISTICS FOR EXISTING INDEXES
-- =============================================

-- Update table statistics for better query planning
ANALYZE public.shops;

-- Update specific statistics for spatial columns
SELECT UpdateGeometrySRID('public', 'shops', 'location', 4326);

-- =============================================
-- VERIFY POSTGIS VERSION AND CAPABILITIES
-- =============================================

-- Log PostGIS version and capabilities for troubleshooting
DO $$
DECLARE
    postgis_version TEXT;
    geos_version TEXT;
    proj_version TEXT;
BEGIN
    SELECT PostGIS_Version() INTO postgis_version;
    SELECT PostGIS_GEOS_Version() INTO geos_version;
    SELECT PostGIS_Proj_Version() INTO proj_version;
    
    RAISE NOTICE 'PostGIS Configuration:';
    RAISE NOTICE '  PostGIS Version: %', postgis_version;
    RAISE NOTICE '  GEOS Version: %', geos_version;
    RAISE NOTICE '  PROJ Version: %', proj_version;
END $$;

-- =============================================
-- CREATE PERFORMANCE MONITORING VIEW
-- =============================================

-- Create a view to monitor spatial index usage and performance
CREATE OR REPLACE VIEW public.spatial_index_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan > 0 THEN ROUND((idx_tup_read::FLOAT / idx_scan), 2)
        ELSE 0 
    END as avg_tuples_per_scan
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%location%' OR indexname LIKE '%spatial%'
ORDER BY idx_scan DESC;

-- Add comment for documentation
COMMENT ON VIEW public.spatial_index_stats IS 'Monitor spatial index usage and performance metrics';

-- =============================================
-- COMPLETION LOG
-- =============================================

-- Log successful completion
DO $$
BEGIN
    RAISE NOTICE 'PostGIS spatial index verification and configuration completed successfully.';
    RAISE NOTICE 'Migration 029_enhance_postgis_spatial_indexes.sql executed at %', NOW();
END $$;
