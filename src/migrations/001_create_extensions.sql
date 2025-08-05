-- Migration: 001_create_extensions.sql
-- Description: Create required PostgreSQL extensions
-- Author: Task Master AI
-- Created: 2025-07-28

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enable additional PostGIS extensions if needed
CREATE EXTENSION IF NOT EXISTS "postgis_topology";
CREATE EXTENSION IF NOT EXISTS "postgis_raster";

-- Create comment for tracking
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions for primary keys';
COMMENT ON EXTENSION "postgis" IS 'PostGIS geometry and geography spatial types and functions';
COMMENT ON EXTENSION "postgis_topology" IS 'PostGIS topology spatial types and functions';
COMMENT ON EXTENSION "postgis_raster" IS 'PostGIS raster types and functions'; 