#!/bin/bash

# PortOne V2 Schema Migration Script
# This script runs the PortOne schema migration against the Supabase database

set -e

# Load environment variables
source .env

# Extract database connection details from SUPABASE_URL
SUPABASE_PROJECT_ID=$(echo $SUPABASE_URL | sed 's/https:\/\/\([^.]*\)\.supabase\.co/\1/')
DB_HOST="db.${SUPABASE_PROJECT_ID}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "🔧 Connecting to Supabase database: $DB_HOST"
echo "📋 Running PortOne V2 schema migration..."

# Run the migration SQL file
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "sql/portone_v2_schema_migration.sql"

echo "✅ Migration completed successfully!"