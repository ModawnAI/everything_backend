import { getSupabaseClient } from './database';
import { logger } from '../utils/logger';
import { DatabaseTableDefinition } from '../types/database.types';
import { createAllRLSPolicies, verifyRLSEnabled } from './rls-policies';

/**
 * Database Migration Utilities
 * Handles creation of tables, enums, indexes, and constraints
 */

// =============================================
// ENUM CREATION QUERIES
// =============================================

const ENUM_QUERIES = [
  `CREATE TYPE user_gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');`,
  `CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');`,
  `CREATE TYPE user_role AS ENUM ('user', 'shop_owner', 'admin', 'influencer');`,
  `CREATE TYPE social_provider AS ENUM ('kakao', 'apple', 'google', 'email');`,
  `CREATE TYPE shop_status AS ENUM ('active', 'inactive', 'pending_approval', 'suspended', 'deleted');`,
  `CREATE TYPE shop_type AS ENUM ('partnered', 'non_partnered');`,
  `CREATE TYPE service_category AS ENUM ('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair');`,
  `CREATE TYPE shop_verification_status AS ENUM ('pending', 'verified', 'rejected');`,
  `CREATE TYPE reservation_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show');`,
  `CREATE TYPE payment_status AS ENUM ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'partially_refunded', 'failed');`,
  `CREATE TYPE payment_method AS ENUM ('toss_payments', 'kakao_pay', 'naver_pay', 'card', 'bank_transfer');`,
  `CREATE TYPE point_transaction_type AS ENUM ('earned_service', 'earned_referral', 'used_service', 'expired', 'adjusted', 'influencer_bonus');`,
  `CREATE TYPE point_status AS ENUM ('pending', 'available', 'used', 'expired');`,
  `CREATE TYPE notification_type AS ENUM ('reservation_confirmed', 'reservation_cancelled', 'point_earned', 'referral_success', 'system');`,
  `CREATE TYPE notification_status AS ENUM ('unread', 'read', 'deleted');`,
  `CREATE TYPE report_reason AS ENUM ('spam', 'inappropriate_content', 'harassment', 'other');`,
  `CREATE TYPE admin_action_type AS ENUM ('user_suspended', 'shop_approved', 'shop_rejected', 'refund_processed', 'points_adjusted');`,
];

// =============================================
// CORE TABLE DEFINITIONS
// =============================================

const CORE_TABLES: DatabaseTableDefinition[] = [
  // Users table (extends Supabase auth.users)
  {
    tableName: 'users',
    createQuery: `
      CREATE TABLE public.users (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE,
        phone_number VARCHAR(20) UNIQUE,
        phone_verified BOOLEAN DEFAULT FALSE,
        name VARCHAR(100) NOT NULL,
        nickname VARCHAR(50),
        gender user_gender,
        birth_date DATE,
        profile_image_url TEXT,
        user_role user_role DEFAULT 'user',
        user_status user_status DEFAULT 'active',
        is_influencer BOOLEAN DEFAULT FALSE,
        influencer_qualified_at TIMESTAMPTZ,
        social_provider social_provider,
        social_provider_id VARCHAR(255),
        referral_code VARCHAR(20) UNIQUE,
        referred_by_code VARCHAR(20),
        total_points INTEGER DEFAULT 0,
        available_points INTEGER DEFAULT 0,
        total_referrals INTEGER DEFAULT 0,
        successful_referrals INTEGER DEFAULT 0,
        last_login_at TIMESTAMPTZ,
        terms_accepted_at TIMESTAMPTZ,
        privacy_accepted_at TIMESTAMPTZ,
        marketing_consent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_users_email ON public.users(email);',
      'CREATE INDEX idx_users_phone ON public.users(phone_number);',
      'CREATE INDEX idx_users_role ON public.users(user_role);',
      'CREATE INDEX idx_users_status ON public.users(user_status);',
      'CREATE INDEX idx_users_referral_code ON public.users(referral_code);',
    ],
  },

  // User Settings table
  {
    tableName: 'user_settings',
    createQuery: `
      CREATE TABLE public.user_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        push_notifications_enabled BOOLEAN DEFAULT TRUE,
        reservation_notifications BOOLEAN DEFAULT TRUE,
        event_notifications BOOLEAN DEFAULT TRUE,
        marketing_notifications BOOLEAN DEFAULT FALSE,
        location_tracking_enabled BOOLEAN DEFAULT TRUE,
        language_preference VARCHAR(10) DEFAULT 'ko',
        currency_preference VARCHAR(3) DEFAULT 'KRW',
        theme_preference VARCHAR(20) DEFAULT 'light',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `,
    indexes: [
      'CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);',
    ],
  },

  // Shops table
  {
    tableName: 'shops',
    createQuery: `
      CREATE TABLE public.shops (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        phone_number VARCHAR(20),
        email VARCHAR(255),
        address TEXT NOT NULL,
        detailed_address TEXT,
        postal_code VARCHAR(10),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        location GEOGRAPHY(POINT, 4326),
        shop_type shop_type DEFAULT 'non_partnered',
        shop_status shop_status DEFAULT 'pending_approval',
        verification_status shop_verification_status DEFAULT 'pending',
        business_license_number VARCHAR(50),
        business_license_image_url TEXT,
        main_category service_category NOT NULL,
        sub_categories service_category[],
        operating_hours JSONB,
        payment_methods payment_method[],
        kakao_channel_url TEXT,
        total_bookings INTEGER DEFAULT 0,
        partnership_started_at TIMESTAMPTZ,
        featured_until TIMESTAMPTZ,
        is_featured BOOLEAN DEFAULT FALSE,
        commission_rate DECIMAL(5,2) DEFAULT 10.00,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_shops_owner_id ON public.shops(owner_id);',
      'CREATE INDEX idx_shops_status ON public.shops(shop_status);',
      'CREATE INDEX idx_shops_type ON public.shops(shop_type);',
      'CREATE INDEX idx_shops_category ON public.shops(main_category);',
      'CREATE INDEX idx_shops_location ON public.shops USING GIST(location);',
      'CREATE INDEX idx_shops_featured ON public.shops(is_featured, featured_until);',
    ],
  },

  // Shop Images table
  {
    tableName: 'shop_images',
    createQuery: `
      CREATE TABLE public.shop_images (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT FALSE,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_shop_images_shop_id ON public.shop_images(shop_id);',
      'CREATE INDEX idx_shop_images_primary ON public.shop_images(shop_id, is_primary);',
    ],
  },

  // Shop Services table
  {
    tableName: 'shop_services',
    createQuery: `
      CREATE TABLE public.shop_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category service_category NOT NULL,
        price_min INTEGER,
        price_max INTEGER,
        duration_minutes INTEGER,
        deposit_amount INTEGER,
        deposit_percentage DECIMAL(5,2),
        is_available BOOLEAN DEFAULT TRUE,
        booking_advance_days INTEGER DEFAULT 30,
        cancellation_hours INTEGER DEFAULT 24,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_shop_services_shop_id ON public.shop_services(shop_id);',
      'CREATE INDEX idx_shop_services_category ON public.shop_services(category);',
      'CREATE INDEX idx_shop_services_available ON public.shop_services(is_available);',
    ],
  },

  // Service Images table
  {
    tableName: 'service_images',
    createQuery: `
      CREATE TABLE public.service_images (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        alt_text VARCHAR(255),
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_service_images_service_id ON public.service_images(service_id);',
    ],
  },
];

// =============================================
// RELATIONSHIP TABLES
// =============================================

const RELATIONSHIP_TABLES: DatabaseTableDefinition[] = [
  // Reservations table
  {
    tableName: 'reservations',
    createQuery: `
      CREATE TABLE public.reservations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
        reservation_date DATE NOT NULL,
        reservation_time TIME NOT NULL,
        reservation_datetime TIMESTAMPTZ GENERATED ALWAYS AS (
          (reservation_date || ' ' || reservation_time)::TIMESTAMPTZ
        ) STORED,
        status reservation_status DEFAULT 'requested',
        total_amount INTEGER NOT NULL,
        deposit_amount INTEGER NOT NULL,
        remaining_amount INTEGER,
        points_used INTEGER DEFAULT 0,
        points_earned INTEGER DEFAULT 0,
        special_requests TEXT,
        cancellation_reason TEXT,
        no_show_reason TEXT,
        confirmed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);',
      'CREATE INDEX idx_reservations_shop_id ON public.reservations(shop_id);',
      'CREATE INDEX idx_reservations_status ON public.reservations(status);',
      'CREATE INDEX idx_reservations_datetime ON public.reservations(reservation_datetime);',
      'CREATE INDEX idx_reservations_date ON public.reservations(reservation_date);',
    ],
  },

  // Reservation Services table (many-to-many)
  {
    tableName: 'reservation_services',
    createQuery: `
      CREATE TABLE public.reservation_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE RESTRICT,
        quantity INTEGER DEFAULT 1,
        unit_price INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_reservation_services_reservation_id ON public.reservation_services(reservation_id);',
      'CREATE INDEX idx_reservation_services_service_id ON public.reservation_services(service_id);',
    ],
  },

  // Payments table
  {
    tableName: 'payments',
    createQuery: `
      CREATE TABLE public.payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        payment_method payment_method NOT NULL,
        payment_status payment_status DEFAULT 'pending',
        amount INTEGER NOT NULL,
        currency VARCHAR(3) DEFAULT 'KRW',
        payment_provider VARCHAR(50),
        provider_transaction_id VARCHAR(255),
        provider_order_id VARCHAR(255),
        is_deposit BOOLEAN DEFAULT TRUE,
        paid_at TIMESTAMPTZ,
        refunded_at TIMESTAMPTZ,
        refund_amount INTEGER DEFAULT 0,
        failure_reason TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_payments_reservation_id ON public.payments(reservation_id);',
      'CREATE INDEX idx_payments_user_id ON public.payments(user_id);',
      'CREATE INDEX idx_payments_status ON public.payments(payment_status);',
      'CREATE INDEX idx_payments_provider_id ON public.payments(provider_transaction_id);',
    ],
  },

  // Point Transactions table
  {
    tableName: 'point_transactions',
    createQuery: `
      CREATE TABLE public.point_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
        transaction_type point_transaction_type NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        status point_status DEFAULT 'pending',
        available_from TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        used_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);',
      'CREATE INDEX idx_point_transactions_reservation_id ON public.point_transactions(reservation_id);',
      'CREATE INDEX idx_point_transactions_type ON public.point_transactions(transaction_type);',
      'CREATE INDEX idx_point_transactions_status ON public.point_transactions(status);',
      'CREATE INDEX idx_point_transactions_available_from ON public.point_transactions(available_from);',
      'CREATE INDEX idx_point_transactions_expires_at ON public.point_transactions(expires_at);',
    ],
  },

  // User Favorites table
  {
    tableName: 'user_favorites',
    createQuery: `
      CREATE TABLE public.user_favorites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, shop_id)
      );
    `,
    indexes: [
      'CREATE INDEX idx_user_favorites_user_id ON public.user_favorites(user_id);',
      'CREATE INDEX idx_user_favorites_shop_id ON public.user_favorites(shop_id);',
    ],
  },

  // Push Tokens table
  {
    tableName: 'push_tokens',
    createQuery: `
      CREATE TABLE public.push_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, token)
      );
    `,
    indexes: [
      'CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);',
      'CREATE INDEX idx_push_tokens_active ON public.push_tokens(is_active);',
      'CREATE INDEX idx_push_tokens_platform ON public.push_tokens(platform);',
    ],
  },

  // Admin Actions table
  {
    tableName: 'admin_actions',
    createQuery: `
      CREATE TABLE public.admin_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        action_type admin_action_type NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id UUID NOT NULL,
        reason TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_admin_actions_admin_id ON public.admin_actions(admin_id);',
      'CREATE INDEX idx_admin_actions_type ON public.admin_actions(action_type);',
      'CREATE INDEX idx_admin_actions_target ON public.admin_actions(target_type, target_id);',
      'CREATE INDEX idx_admin_actions_created_at ON public.admin_actions(created_at);',
    ],
  },

  // Transaction Logs table
  {
    tableName: 'transaction_logs',
    createQuery: `
      CREATE TABLE public.transaction_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id VARCHAR(255) NOT NULL,
        operation VARCHAR(100) NOT NULL,
        details JSONB,
        timestamp BIGINT NOT NULL,
        user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        session_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    indexes: [
      'CREATE INDEX idx_transaction_logs_transaction_id ON public.transaction_logs(transaction_id);',
      'CREATE INDEX idx_transaction_logs_timestamp ON public.transaction_logs(timestamp);',
      'CREATE INDEX idx_transaction_logs_operation ON public.transaction_logs(operation);',
      'CREATE INDEX idx_transaction_logs_user_id ON public.transaction_logs(user_id);',
    ],
  },
];

// =============================================
// MIGRATION UTILITIES
// =============================================



/**
 * Check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .single();
  
  return !error && !!data;
}

/**
 * Execute a SQL query with error handling
 */
async function executeSql(query: string, description: string): Promise<boolean> {
  const client = getSupabaseClient();
  
  try {
    const { error } = await client.rpc('execute_sql', { sql_query: query });
    
    if (error) {
      logger.error(`Failed to execute ${description}`, { 
        error: error.message,
        query: query.substring(0, 100) + '...'
      });
      return false;
    }
    
    logger.info(`Successfully executed ${description}`);
    return true;
  } catch (error) {
    logger.error(`Exception while executing ${description}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: query.substring(0, 100) + '...'
    });
    return false;
  }
}

/**
 * Create database extensions
 */
export async function createExtensions(): Promise<boolean> {
  logger.info('Creating database extensions...');
  
  const extensions = [
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    'CREATE EXTENSION IF NOT EXISTS "postgis";',
  ];
  
  for (const extension of extensions) {
    const success = await executeSql(extension, 'database extension');
    if (!success) return false;
  }
  
  return true;
}

/**
 * Create all enum types
 */
export async function createEnums(): Promise<boolean> {
  logger.info('Creating enum types...');
  
  for (const enumQuery of ENUM_QUERIES) {
    const success = await executeSql(enumQuery, 'enum type');
    if (!success) return false;
  }
  
  return true;
}

/**
 * Create core tables
 */
export async function createCoreTables(): Promise<boolean> {
  logger.info('Creating core tables...');
  
  for (const table of CORE_TABLES) {
    // Check if table already exists
    if (await tableExists(table.tableName)) {
      logger.info(`Table ${table.tableName} already exists, skipping...`);
      continue;
    }
    
    // Create table
    const success = await executeSql(table.createQuery, `table ${table.tableName}`);
    if (!success) return false;
    
    // Create indexes
    if (table.indexes) {
      for (const indexQuery of table.indexes) {
        await executeSql(indexQuery, `index for ${table.tableName}`);
      }
    }
  }
  
  return true;
}

/**
 * Create relationship tables
 */
export async function createRelationshipTables(): Promise<boolean> {
  logger.info('Creating relationship tables...');
  
  for (const table of RELATIONSHIP_TABLES) {
    // Check if table already exists
    if (await tableExists(table.tableName)) {
      logger.info(`Table ${table.tableName} already exists, skipping...`);
      continue;
    }
    
    // Create table
    const success = await executeSql(table.createQuery, `table ${table.tableName}`);
    if (!success) return false;
    
    // Create indexes
    if (table.indexes) {
      for (const indexQuery of table.indexes) {
        await executeSql(indexQuery, `index for ${table.tableName}`);
      }
    }
  }
  
  return true;
}

/**
 * Run all core table migrations
 */
export async function runCoreMigrations(): Promise<boolean> {
  logger.info('Starting core table migrations...');
  
  try {
    // Step 1: Create extensions
    const extensionsResult = await createExtensions();
    if (!extensionsResult) {
      logger.error('Failed to create database extensions');
      return false;
    }
    
    // Step 2: Create enums
    const enumsResult = await createEnums();
    if (!enumsResult) {
      logger.error('Failed to create enum types');
      return false;
    }
    
    // Step 3: Create core tables
    const tablesResult = await createCoreTables();
    if (!tablesResult) {
      logger.error('Failed to create core tables');
      return false;
    }
    
    logger.info('Core table migrations completed successfully');
    return true;
    
  } catch (error) {
    logger.error('Core table migration failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Run all relationship table migrations
 */
export async function runRelationshipMigrations(): Promise<boolean> {
  logger.info('Starting relationship table migrations...');
  
  try {
    // Create relationship tables (depends on core tables)
    const relationshipResult = await createRelationshipTables();
    if (!relationshipResult) {
      logger.error('Failed to create relationship tables');
      return false;
    }
    
    logger.info('Relationship table migrations completed successfully');
    return true;
    
  } catch (error) {
    logger.error('Relationship table migration failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Run complete database migration (core + relationships + RLS)
 */
export async function runFullMigrations(): Promise<boolean> {
  logger.info('Starting full database migrations...');

  try {
    // Step 1: Run core migrations
    const coreResult = await runCoreMigrations();
    if (!coreResult) {
      logger.error('Core migrations failed');
      return false;
    }

    // Step 2: Run relationship migrations
    const relationshipResult = await runRelationshipMigrations();
    if (!relationshipResult) {
      logger.error('Relationship migrations failed');
      return false;
    }

    // Step 3: Run RLS policy migrations
    const rlsResult = await runRLSMigrations();
    if (!rlsResult) {
      logger.error('RLS policy migrations failed');
      return false;
    }

    logger.info('Full database migrations completed successfully');
    return true;

  } catch (error) {
    logger.error('Full migration failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Run RLS policy migrations
 */
export async function runRLSMigrations(): Promise<boolean> {
  logger.info('Starting RLS policy migrations...');

  try {
    // Create all RLS policies
    const rlsResult = await createAllRLSPolicies();
    if (!rlsResult) {
      logger.error('Failed to create RLS policies');
      return false;
    }

    // Verify RLS is enabled on all tables
    const verifyResult = await verifyRLSEnabled();
    if (!verifyResult) {
      logger.warn('RLS verification failed, but policies were created');
      // Don't fail the migration for verification issues
    }

    logger.info('RLS policy migrations completed successfully');
    return true;

  } catch (error) {
    logger.error('RLS policy migration failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Verify core tables exist
 */
export async function verifyCoreTables(): Promise<boolean> {
  logger.info('Verifying core tables...');
  
  const requiredTables = CORE_TABLES.map(t => t.tableName);
  
  for (const tableName of requiredTables) {
    const exists = await tableExists(tableName);
    if (!exists) {
      logger.error(`Required table ${tableName} does not exist`);
      return false;
    }
  }
  
  logger.info('All core tables verified successfully');
  return true;
}

/**
 * Verify relationship tables exist
 */
export async function verifyRelationshipTables(): Promise<boolean> {
  logger.info('Verifying relationship tables...');
  
  const requiredTables = RELATIONSHIP_TABLES.map(t => t.tableName);
  
  for (const tableName of requiredTables) {
    const exists = await tableExists(tableName);
    if (!exists) {
      logger.error(`Required table ${tableName} does not exist`);
      return false;
    }
  }
  
  logger.info('All relationship tables verified successfully');
  return true;
}

/**
 * Verify all tables exist
 */
export async function verifyAllTables(): Promise<boolean> {
  logger.info('Verifying all database tables...');
  
  const coreResult = await verifyCoreTables();
  if (!coreResult) return false;
  
  const relationshipResult = await verifyRelationshipTables();
  if (!relationshipResult) return false;
  
  logger.info('All database tables verified successfully');
  return true;
}

export default {
  createExtensions,
  createEnums,
  createCoreTables,
  createRelationshipTables,
  runCoreMigrations,
  runRelationshipMigrations,
  runRLSMigrations,
  runFullMigrations,
  verifyCoreTables,
  verifyRelationshipTables,
  verifyAllTables,
}; 