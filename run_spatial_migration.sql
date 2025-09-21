-- Direct SQL execution for spatial index migration
-- This script runs the composite spatial indexes migration

\echo 'Starting composite spatial indexes migration...'

-- Source the migration file
\i src/migrations/031_create_composite_spatial_indexes.sql

\echo 'Composite spatial indexes migration completed!'

-- Show current indexes on shops table
\echo 'Current indexes on shops table:'
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'shops'
ORDER BY indexname;

-- Show spatial index usage statistics
\echo 'Spatial index usage statistics:'
SELECT * FROM public.get_spatial_index_usage();
