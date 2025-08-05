# Database Migrations Guide

## Overview

The 에뷰리띵 (Everything) Backend uses a structured database migration system to manage schema changes, data transformations, and database deployments across different environments.

## Migration Structure

### File Organization

```
src/migrations/
├── 001_create_extensions.sql      # PostgreSQL extensions
├── 002_create_enums.sql           # Enum types
├── 003_create_core_tables.sql     # Core database tables
├── 004_create_relationship_tables.sql # Relationship tables
├── 005_create_rls_policies.sql    # Row Level Security policies
└── migration-runner.ts            # Migration management system
```

### Migration Naming Convention

- **Format**: `{version}_{description}.sql`
- **Version**: 3-digit zero-padded number (001, 002, 003...)
- **Description**: Snake_case description of the migration
- **Examples**:
  - `001_create_extensions.sql`
  - `002_create_enums.sql`
  - `003_create_core_tables.sql`

## Migration Content

### 1. Extensions (001_create_extensions.sql)

Creates required PostgreSQL extensions:
- **uuid-ossp**: UUID generation for primary keys
- **postgis**: Spatial data support for location features
- **postgis_topology**: Advanced spatial topology functions
- **postgis_raster**: Raster data support

### 2. Enums (002_create_enums.sql)

Defines all enum types:
- **User enums**: `user_gender`, `user_status`, `user_role`, `social_provider`
- **Shop enums**: `shop_status`, `shop_type`, `service_category`, `shop_verification_status`
- **Transaction enums**: `reservation_status`, `payment_status`, `payment_method`
- **System enums**: `point_transaction_type`, `point_status`, `notification_type`, `admin_action_type`

### 3. Core Tables (003_create_core_tables.sql)

Creates primary business entities:
- **users**: User profiles extending Supabase auth
- **user_settings**: User preferences and notification settings
- **shops**: Beauty shops and service providers
- **shop_images**: Shop photos and gallery
- **shop_services**: Services offered by shops
- **service_images**: Service portfolio images

**Includes comprehensive indexes for performance:**
- GIST indexes for spatial data
- B-tree indexes for foreign keys and queries
- Composite indexes for complex queries

### 4. Relationship Tables (004_create_relationship_tables.sql)

Creates transaction and relationship entities:
- **reservations**: User bookings and appointments
- **reservation_services**: Services included in reservations
- **payments**: Payment transactions and billing
- **point_transactions**: Point earning/spending records
- **user_favorites**: User favorite shops
- **push_tokens**: Mobile notification tokens
- **admin_actions**: Administrative audit trail

### 5. RLS Policies (005_create_rls_policies.sql)

Implements Row Level Security:
- **User data isolation**: Users can only access their own data
- **Shop owner access**: Owners manage their own shops
- **Public shop discovery**: Read access for active shops
- **Admin oversight**: Controlled administrative access
- **Financial protection**: Strict payment and point security

## Migration Runner System

### Features

- **Version Tracking**: Maintains migration history in `schema_migrations` table
- **Checksum Validation**: Ensures migration integrity
- **Rollback Support**: Planned rollback capabilities
- **Environment-Specific**: Different configs for dev/staging/production
- **Error Handling**: Comprehensive logging and error recovery

### Usage

```typescript
import { runMigrations, getMigrationStatus, validateMigrations } from './migration-runner';

// Run all pending migrations
const success = await runMigrations();

// Check migration status
const status = await getMigrationStatus();
console.log(`Applied: ${status.applied}/${status.available} migrations`);

// Validate migration integrity
const isValid = await validateMigrations();
```

### Migration Status Table

The system creates a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE public.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deployment Process

### Development Environment

1. **Run Migrations**:
   ```bash
   npm run migrate
   ```

2. **Check Status**:
   ```bash
   npm run migrate:status
   ```

3. **Validate Integrity**:
   ```bash
   npm run migrate:validate
   ```

### Production Deployment

For production environments, migrations should be executed through Supabase dashboard or CLI:

1. **Supabase CLI**:
   ```bash
   supabase db push
   ```

2. **Manual Execution**:
   - Copy SQL content from migration files
   - Execute through Supabase SQL Editor
   - Verify completion in `schema_migrations` table

### Rollback Strategy

Currently planned features for rollback support:
- **Down migrations**: Reverse migration scripts
- **Snapshot restoration**: Database state snapshots
- **Selective rollback**: Target specific migration versions

## Database Schema Summary

### Tables Created (13 total)

1. **users** - User profiles and authentication
2. **user_settings** - User preferences
3. **shops** - Beauty service providers
4. **shop_images** - Shop photo galleries
5. **shop_services** - Services offered
6. **service_images** - Service portfolios
7. **reservations** - Booking appointments
8. **reservation_services** - Booking details
9. **payments** - Financial transactions
10. **point_transactions** - Reward system
11. **user_favorites** - User preferences
12. **push_tokens** - Notifications
13. **admin_actions** - Audit trails

### Security Features

- **Row Level Security (RLS)**: 34 policies across all tables
- **Multi-tenant isolation**: Users/shops only see their own data
- **Role-based access**: Different permissions for users/owners/admins
- **Financial protection**: Strict access controls for payments/points

### Performance Optimizations

- **Spatial indexes**: GIST indexes for location-based queries
- **Composite indexes**: Multi-column indexes for complex queries
- **Foreign key indexes**: Fast relationship lookups
- **Status indexes**: Quick filtering by entity status

## PRD Compliance

### ✅ User Management
- Complete user profile system with social auth
- Multi-role support (user, shop_owner, admin, influencer)
- Privacy settings and consent management

### ✅ Shop Management
- Comprehensive shop profiles with verification
- Service catalog with categories and pricing
- Image galleries and business licensing

### ✅ Booking System
- Reservation management with status tracking
- Service selection and pricing calculations
- Deposit and payment processing

### ✅ Payment Integration
- Multiple payment methods (Toss, Kakao, Naver, etc.)
- Transaction tracking and refund support
- Financial audit trails

### ✅ Points System
- Point earning through service usage and referrals
- Point expiration and transaction history
- Influencer bonus point system

### ✅ Location Features
- PostGIS spatial data support
- Location-based shop discovery
- Geographic search optimization

## Environment Configuration

### Required Environment Variables

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Migrations
MIGRATION_ENV=development
MIGRATION_AUTO_RUN=false
```

### Migration Settings

- **Development**: Auto-run migrations on startup
- **Staging**: Manual migration execution
- **Production**: CLI or dashboard execution only

## Monitoring and Maintenance

### Health Checks

- Migration status validation
- Checksum integrity verification
- Performance index monitoring
- RLS policy enforcement

### Logging

All migration activities are logged with:
- Execution timestamps
- Performance metrics
- Error details
- Checksum validation results

## Troubleshooting

### Common Issues

1. **Checksum Mismatch**:
   - Migration file was modified after deployment
   - Solution: Restore original file or create new migration

2. **Permission Errors**:
   - Insufficient database privileges
   - Solution: Use service role key or admin access

3. **Dependency Failures**:
   - Missing required extensions or tables
   - Solution: Run migrations in correct order

4. **RLS Policy Conflicts**:
   - Existing policies blocking operations
   - Solution: Review and update policy conditions

### Recovery Procedures

1. **Failed Migration**:
   - Check logs for specific error
   - Fix underlying issue
   - Re-run migration

2. **Corrupted State**:
   - Validate migration integrity
   - Restore from backup if needed
   - Re-apply migrations in order

## Future Enhancements

### Planned Features

- **Automated rollbacks**: Reverse migration scripts
- **Blue-green deployments**: Zero-downtime schema changes
- **Schema diffs**: Automatic migration generation
- **Data migrations**: Support for data transformation scripts
- **Environment sync**: Schema synchronization across environments

### Performance Improvements

- **Parallel execution**: Run independent migrations concurrently
- **Incremental updates**: Only apply changed migrations
- **Compression**: Reduce migration file sizes
- **Caching**: Cache migration status and checksums 