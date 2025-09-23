# Database Performance Optimization Guide

This guide documents the database performance optimization migration that addresses issues identified by the Supabase database linter.

## Overview

The Supabase database linter identified two main performance issues:

1. **20 Unindexed Foreign Keys** - Foreign key constraints without covering indexes
2. **100+ Unused Indexes** - Indexes that have never been used, consuming storage and slowing writes

## Migration Details

### Migration File
- **File**: `src/migrations/068_database_performance_optimization.sql`
- **Purpose**: Add missing indexes and remove unused ones
- **Impact**: Improves query performance and reduces storage overhead

### What the Migration Does

#### Part 1: Add Missing Foreign Key Indexes
Adds indexes for the following foreign key constraints (only for tables that exist in the current schema):

| Table | Foreign Key Column | Index Name |
|-------|-------------------|------------|
| admin_actions | admin_id | idx_admin_actions_admin_id |
| announcements | created_by | idx_announcements_created_by |
| content_reports | reporter_id | idx_content_reports_reporter_id |
| content_reports | reviewed_by | idx_content_reports_reviewed_by |
| moderation_audit_trail | moderator_id | idx_moderation_audit_trail_moderator_id |
| post_images | post_id | idx_post_images_post_id |
| reservation_services | reservation_id | idx_reservation_services_reservation_id |
| reservation_services | service_id | idx_reservation_services_service_id |
| service_images | service_id | idx_service_images_service_id |
| shop_reports | reporter_id | idx_shop_reports_reporter_id |
| shop_reports | reviewed_by | idx_shop_reports_reviewed_by |
| shop_services | shop_id | idx_shop_services_shop_id |
| user_favorites | user_id | idx_user_favorites_user_id |
| user_favorites | shop_id | idx_user_favorites_shop_id |
| moderation_rules | created_by | idx_moderation_rules_created_by |
| moderation_actions | moderator_id | idx_moderation_actions_moderator_id |
| security_events | user_id | idx_security_events_user_id |
| user_role_history | user_id | idx_user_role_history_user_id |
| user_role_history | changed_by | idx_user_role_history_changed_by |
| conflicts | resolved_by | idx_conflicts_resolved_by |

#### Part 2: Remove Unused Indexes
Removes unused indexes across multiple tables including:

- **Shop Categories**: 2 unused indexes
- **Service Types**: 4 unused indexes  
- **Moderation System**: 15+ unused indexes
- **Security Events**: 10+ unused indexes
- **Refresh Tokens**: 5 unused indexes
- **Users**: 5 unused indexes
- **Reservations**: 2 unused indexes
- **Notifications**: 4 unused indexes
- **Feed System**: 7 unused indexes
- **Shops**: 11 unused indexes
- **And more...**

## Running the Migration

### Prerequisites
- Node.js installed
- Environment variables configured:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Method 1: Using the Migration Script (Recommended)

```bash
# Make the script executable
chmod +x scripts/run-performance-migration.js

# Run the migration
node scripts/run-performance-migration.js
```

### Method 2: Manual SQL Execution

1. Open Supabase SQL Editor
2. Copy the contents of `src/migrations/068_database_performance_optimization.sql`
3. Execute the SQL in parts:
   - First: Add foreign key indexes
   - Second: Remove unused indexes
   - Third: Run `VACUUM ANALYZE;`

## Monitoring Performance

### Performance Monitor Script

```bash
# Run the performance monitor
node scripts/monitor-db-performance.js
```

This script provides:
- Database size and index count
- Index usage statistics
- Unused indexes detection
- Foreign key constraint status
- Table statistics and recommendations

### Manual Monitoring Queries

#### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY times_used DESC;
```

#### Check Foreign Key Indexes
```sql
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  CASE 
    WHEN i.indexname IS NOT NULL THEN 'INDEXED'
    ELSE 'NOT_INDEXED'
  END as index_status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_indexes i ON i.tablename = tc.table_name 
  AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public';
```

#### Check Unused Indexes
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Expected Performance Improvements

### Query Performance
- **Faster JOINs**: Foreign key indexes enable efficient JOIN operations
- **Better Filtering**: Queries filtering by foreign key columns will be faster
- **Improved Query Plans**: PostgreSQL can choose better execution plans

### Storage Optimization
- **Reduced Storage**: Removing unused indexes saves disk space
- **Faster Writes**: Fewer indexes mean faster INSERT/UPDATE operations
- **Lower Maintenance**: Less index maintenance overhead

### Specific Improvements
- **User-Shop Relationships**: Faster queries joining users with their shops
- **Reservation Queries**: Improved performance for reservation-related JOINs
- **Moderation System**: Better performance for admin and moderation queries
- **Payment Processing**: Faster payment and retry operation queries

## Best Practices

### Before Running Migration
1. **Backup Database**: Always backup before running migrations
2. **Test Environment**: Run migration on staging environment first
3. **Low Traffic**: Schedule during low-traffic periods
4. **Monitor Resources**: Ensure sufficient database resources

### After Running Migration
1. **Update Statistics**: Run `VACUUM ANALYZE;` to update table statistics
2. **Monitor Performance**: Use the monitoring script to track improvements
3. **Test Queries**: Run critical queries to verify performance improvements
4. **Check Application**: Ensure no performance regressions in application

### Ongoing Maintenance
1. **Regular Monitoring**: Run performance monitor weekly
2. **Index Usage**: Check for new unused indexes periodically
3. **Query Analysis**: Use `EXPLAIN ANALYZE` for slow queries
4. **Statistics Updates**: Run `VACUUM ANALYZE` after significant data changes

## Troubleshooting

### Common Issues

#### Migration Fails
- **Check Permissions**: Ensure service role has sufficient permissions
- **Database Load**: Run during low-traffic periods
- **Syntax Errors**: Verify SQL syntax in migration file

#### Performance Regression
- **Check Indexes**: Verify critical indexes weren't accidentally removed
- **Query Plans**: Use `EXPLAIN ANALYZE` to check query execution plans
- **Statistics**: Run `VACUUM ANALYZE` to update table statistics

#### Storage Issues
- **Index Size**: Check if removed indexes were actually needed
- **Recreate Indexes**: If needed, recreate specific indexes manually

### Recovery Steps

1. **Restore from Backup**: If critical issues occur
2. **Recreate Indexes**: Add back specific indexes if needed
3. **Rollback Migration**: Use database rollback if available
4. **Contact Support**: Reach out to Supabase support if needed

## Monitoring Dashboard

Consider setting up a monitoring dashboard with:

- **Index Usage Metrics**: Track which indexes are being used
- **Query Performance**: Monitor slow query logs
- **Storage Usage**: Track database size over time
- **Foreign Key Performance**: Monitor JOIN query performance

## Conclusion

This performance optimization migration addresses critical database performance issues identified by the Supabase linter. The improvements will result in:

- ✅ Better query performance for JOIN operations
- ✅ Reduced storage overhead from unused indexes
- ✅ Faster write operations due to fewer indexes
- ✅ Improved overall database efficiency

Regular monitoring and maintenance will ensure these improvements are sustained over time.
