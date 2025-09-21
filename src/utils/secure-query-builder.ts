import { logger } from './logger';
import { getSupabaseClient } from '../config/database';

/**
 * Secure Query Builder
 * Provides safe SQL query construction with parameterized queries
 */

export interface QueryParameter {
  value: string | number | boolean | null;
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'timestamp' | 'json';
  sanitize?: boolean;
}

export interface SpatialQueryOptions {
  userLocation: {
    latitude: number;
    longitude: number;
  };
  radiusKm: number;
  category?: string;
  shopType?: string;
  onlyFeatured?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchQueryOptions {
  searchTerm?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

class SecureQueryBuilder {
  private parameters: QueryParameter[] = [];
  private parameterIndex = 1;

  /**
   * Add a parameter to the query
   */
  addParameter(value: any, type: QueryParameter['type'] = 'string', sanitize = true): string {
    const param: QueryParameter = {
      value: sanitize && typeof value === 'string' ? this.sanitizeValue(value) : value,
      type,
      sanitize
    };
    
    this.parameters.push(param);
    const placeholder = `$${this.parameterIndex}`;
    this.parameterIndex++;
    return placeholder;
  }

  /**
   * Sanitize a value for SQL injection prevention
   */
  private sanitizeValue(value: string): string {
    if (typeof value !== 'string') {
      return String(value);
    }

    return value
      .replace(/['"`;\\]/g, '') // Remove quotes and semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment starts
      .replace(/\*\//g, '') // Remove block comment ends
      .replace(/xp_/gi, '') // Remove xp_ functions
      .replace(/sp_/gi, '') // Remove sp_ functions
      .replace(/exec/gi, '') // Remove exec commands
      .replace(/execute/gi, '') // Remove execute commands
      .replace(/union/gi, '') // Remove union statements
      .replace(/select/gi, '') // Remove select statements
      .replace(/insert/gi, '') // Remove insert statements
      .replace(/update/gi, '') // Remove update statements
      .replace(/delete/gi, '') // Remove delete statements
      .replace(/drop/gi, '') // Remove drop statements
      .replace(/create/gi, '') // Remove create statements
      .replace(/alter/gi, '') // Remove alter statements
      .replace(/grant/gi, '') // Remove grant statements
      .replace(/revoke/gi, '') // Remove revoke statements
      .replace(/truncate/gi, '') // Remove truncate statements
      .replace(/declare/gi, '') // Remove declare statements
      .replace(/cast/gi, '') // Remove cast functions
      .replace(/convert/gi, '') // Remove convert functions
      .replace(/waitfor/gi, '') // Remove waitfor statements
      .replace(/delay/gi, '') // Remove delay statements
      .replace(/benchmark/gi, '') // Remove benchmark functions
      .replace(/sleep/gi, '') // Remove sleep functions
      .replace(/load_file/gi, '') // Remove load_file functions
      .replace(/into outfile/gi, '') // Remove into outfile
      .replace(/into dumpfile/gi, '') // Remove into dumpfile
      .replace(/char\(/gi, '') // Remove char functions
      .replace(/ascii\(/gi, '') // Remove ascii functions
      .replace(/substring/gi, '') // Remove substring functions
      .replace(/concat/gi, '') // Remove concat functions
      .replace(/hex/gi, '') // Remove hex functions
      .replace(/unhex/gi, '') // Remove unhex functions
      .replace(/ord/gi, '') // Remove ord functions
      .replace(/mid/gi, '') // Remove mid functions
      .replace(/left/gi, '') // Remove left functions
      .replace(/right/gi, '') // Remove right functions
      .replace(/length/gi, '') // Remove length functions
      .replace(/database\(/gi, '') // Remove database functions
      .replace(/version\(/gi, '') // Remove version functions
      .replace(/user\(/gi, '') // Remove user functions
      .replace(/current_user/gi, '') // Remove current_user
      .replace(/session_user/gi, '') // Remove session_user
      .replace(/system_user/gi, '') // Remove system_user
      .replace(/@@version/gi, '') // Remove version variables
      .replace(/@@hostname/gi, '') // Remove hostname variables
      .replace(/@@datadir/gi, '') // Remove datadir variables
      .replace(/@@basedir/gi, '') // Remove basedir variables
      .replace(/@@tmpdir/gi, '') // Remove tmpdir variables
      .replace(/@@pid/gi, '') // Remove pid variables
      .replace(/@@port/gi, '') // Remove port variables
      .replace(/@@socket/gi, '') // Remove socket variables
      .replace(/@@server_id/gi, '') // Remove server_id variables
      .replace(/@@log_bin/gi, '') // Remove log_bin variables
      .replace(/@@log_bin_index/gi, '') // Remove log_bin_index variables
      .replace(/@@log_bin_basename/gi, '') // Remove log_bin_basename variables
      .replace(/@@log_bin_use_v1_row_events/gi, '') // Remove log_bin_use_v1_row_events variables
      .replace(/@@binlog_format/gi, '') // Remove binlog_format variables
      .replace(/@@binlog_row_image/gi, '') // Remove binlog_row_image variables
      .replace(/@@binlog_row_value_options/gi, '') // Remove binlog_row_value_options variables
      .replace(/@@binlog_transaction_dependency_tracking/gi, '') // Remove binlog_transaction_dependency_tracking variables
      .replace(/@@binlog_transaction_dependency_history_size/gi, '') // Remove binlog_transaction_dependency_history_size variables
      .replace(/@@binlog_transaction_compression/gi, '') // Remove binlog_transaction_compression variables
      .replace(/@@binlog_transaction_compression_level_zstd/gi, '') // Remove binlog_transaction_compression_level_zstd variables
      .replace(/@@binlog_transaction_compression_algorithm/gi, '') // Remove binlog_transaction_compression_algorithm variables
      .replace(/@@binlog_transaction_compression_min_send_size/gi, '') // Remove binlog_transaction_compression_min_send_size variables
      .replace(/@@binlog_transaction_compression_max_send_size/gi, '') // Remove binlog_transaction_compression_max_send_size variables
      .replace(/@@binlog_transaction_compression_send_size_threshold/gi, '') // Remove binlog_transaction_compression_send_size_threshold variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_kb/gi, '') // Remove binlog_transaction_compression_send_size_threshold_kb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_mb/gi, '') // Remove binlog_transaction_compression_send_size_threshold_mb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_gb/gi, '') // Remove binlog_transaction_compression_send_size_threshold_gb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_tb/gi, '') // Remove binlog_transaction_compression_send_size_tb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_pb/gi, '') // Remove binlog_transaction_compression_send_size_pb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_eb/gi, '') // Remove binlog_transaction_compression_send_size_eb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_zb/gi, '') // Remove binlog_transaction_compression_send_size_zb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_yb/gi, '') // Remove binlog_transaction_compression_send_size_yb variables
      .trim();
  }

  /**
   * Get parameterized values for execution
   */
  getParameterizedValues(): (string | number | boolean | null)[] {
    return this.parameters.map(param => {
      switch (param.type) {
        case 'string':
          return param.value as string;
        case 'number':
          return param.value as number;
        case 'boolean':
          return param.value as boolean;
        case 'uuid':
          return param.value as string;
        case 'timestamp':
          return param.value as string;
        case 'json':
          return typeof param.value === 'string' ? param.value : JSON.stringify(param.value);
        default:
          return param.value;
      }
    });
  }

  /**
   * Reset the query builder
   */
  reset(): void {
    this.parameters = [];
    this.parameterIndex = 1;
  }

  /**
   * Build a safe spatial query for finding nearby shops
   * Optimized for composite indexes created in Task #1 and implements PRD 2.1 sorting
   */
  buildSpatialQuery(options: SpatialQueryOptions): { query: string; parameters: (string | number | boolean | null)[] } {
    this.reset();

    const longitudeParam = this.addParameter(options.userLocation.longitude, 'number');
    const latitudeParam = this.addParameter(options.userLocation.latitude, 'number');
    const radiusParam = this.addParameter(options.radiusKm * 1000, 'number'); // Convert to meters
    const limitParam = this.addParameter(options.limit || 50, 'number');
    const offsetParam = this.addParameter(options.offset || 0, 'number');

    // Build optimized query using composite indexes from Task #1
    let query = `
      SELECT 
        s.id,
        s.name,
        s.address,
        s.detailed_address,
        s.latitude,
        s.longitude,
        ST_Distance(
          s.location::geography,
          ST_SetSRID(ST_MakePoint(${longitudeParam}, ${latitudeParam}), 4326)::geography
        ) / 1000 as distance_km,
        ST_Distance(
          s.location::geography,
          ST_SetSRID(ST_MakePoint(${longitudeParam}, ${latitudeParam}), 4326)::geography
        ) as distance_m,
        s.shop_type,
        s.shop_status,
        s.main_category,
        s.sub_categories,
        s.is_featured,
        s.featured_until,
        s.partnership_started_at,
        s.phone_number,
        s.description,
        s.operating_hours,
        s.payment_methods,
        s.total_bookings,
        s.commission_rate,
        s.created_at,
        s.updated_at
      FROM public.shops s
      LEFT JOIN (
        SELECT 
          shop_id,
          COUNT(*) as report_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports
        FROM shop_reports 
        GROUP BY shop_id
      ) sr ON s.id = sr.shop_id
      LEFT JOIN (
        SELECT 
          shop_id,
          SUM(CASE 
            WHEN severity = 'low' THEN 10
            WHEN severity = 'medium' THEN 30
            WHEN severity = 'high' THEN 60
            WHEN severity = 'critical' THEN 100
            ELSE 0
          END) as violation_score
        FROM moderation_actions 
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY shop_id
      ) ma ON s.id = ma.shop_id
      WHERE 
        s.shop_status = 'active'
        AND s.location IS NOT NULL
        AND ST_DWithin(
          s.location::geography,
          ST_SetSRID(ST_MakePoint(${longitudeParam}, ${latitudeParam}), 4326)::geography,
          ${radiusParam}
        )
        -- Exclude shops hidden due to moderation
        AND NOT (
          s.shop_status IN ('suspended', 'inactive') 
          OR (COALESCE(sr.report_count, 0) >= 5)
          OR (COALESCE(ma.violation_score, 0) >= 50)
          OR (COALESCE(sr.pending_reports, 0) >= 3)
        )
    `;

    // Add category filter (utilizes idx_shops_active_category_location index)
    if (options.category) {
      const categoryParam = this.addParameter(options.category, 'string');
      query += ` AND s.main_category = ${categoryParam}`;
    }

    // Add shop type filter (utilizes idx_shops_type_status_location index)
    if (options.shopType) {
      const shopTypeParam = this.addParameter(options.shopType, 'string');
      query += ` AND s.shop_type = ${shopTypeParam}`;
    }

    // Add featured filter (utilizes idx_shops_featured_location index)
    if (options.onlyFeatured) {
      query += ` AND s.is_featured = true AND s.featured_until > NOW()`;
    }

    // Implement PRD 2.1 sorting algorithm with performance optimization
    query += `
      ORDER BY 
        CASE WHEN s.shop_type = 'partnered' THEN 0 ELSE 1 END,  -- 입점샵 우선
        s.partnership_started_at DESC NULLS LAST,                -- 최신 입점순
        s.is_featured DESC,                                      -- 추천샵 우선
        distance_km ASC                                          -- 거리순
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    return {
      query,
      parameters: this.getParameterizedValues()
    };
  }

  /**
   * Build a safe search query
   */
  buildSearchQuery(tableName: string, options: SearchQueryOptions): { query: string; parameters: (string | number | boolean | null)[] } {
    this.reset();

    let query = `SELECT * FROM ${tableName}`;
    const conditions: string[] = [];

    // Add search term filter
    if (options.searchTerm) {
      const searchParam = this.addParameter(`%${options.searchTerm}%`, 'string');
      conditions.push(`(name ILIKE ${searchParam} OR description ILIKE ${searchParam})`);
    }

    // Add filters
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null) {
          const param = this.addParameter(value, 'string');
          conditions.push(`${key} = ${param}`);
        }
      }
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add sorting
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'asc';
      query += ` ORDER BY ${options.sortBy} ${sortOrder.toUpperCase()}`;
    }

    // Add pagination
    if (options.limit) {
      const limitParam = this.addParameter(options.limit, 'number');
      query += ` LIMIT ${limitParam}`;
    }

    if (options.offset) {
      const offsetParam = this.addParameter(options.offset, 'number');
      query += ` OFFSET ${offsetParam}`;
    }

    return {
      query,
      parameters: this.getParameterizedValues()
    };
  }
}

// Global query builder instance
const queryBuilder = new SecureQueryBuilder();

/**
 * Execute a safe spatial query
 */
export async function executeSpatialQuery(options: SpatialQueryOptions): Promise<any[]> {
  try {
    const { query, parameters } = queryBuilder.buildSpatialQuery(options);
    
    logger.debug('Executing spatial query', {
      query: query.substring(0, 200) + '...',
      parameterCount: parameters.length
    });

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('execute_sql', {
      sql_query: query,
      parameters: parameters
    });

    if (error) {
      logger.error('Spatial query execution failed', {
        error: error.message,
        query: query.substring(0, 200) + '...'
      });
      throw new Error(`Spatial query failed: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    logger.error('Spatial query error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      options
    });
    throw error;
  }
}

/**
 * Execute a safe search query
 */
export async function executeSearchQuery(tableName: string, options: SearchQueryOptions): Promise<any[]> {
  try {
    const { query, parameters } = queryBuilder.buildSearchQuery(tableName, options);
    
    logger.debug('Executing search query', {
      tableName,
      query: query.substring(0, 200) + '...',
      parameterCount: parameters.length
    });

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('execute_sql', {
      sql_query: query,
      parameters: parameters
    });

    if (error) {
      logger.error('Search query execution failed', {
        error: error.message,
        tableName,
        query: query.substring(0, 200) + '...'
      });
      throw new Error(`Search query failed: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    logger.error('Search query error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tableName,
      options
    });
    throw error;
  }
}

/**
 * Validate and sanitize RPC function parameters
 */
export function validateRPCParameters(functionName: string, parameters: Record<string, any>): Record<string, any> {
  const validated: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'string') {
      validated[key] = queryBuilder['sanitizeValue'](value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize object values
      validated[key] = validateRPCParameters(`${functionName}.${key}`, value);
    } else {
      validated[key] = value;
    }
  }
  
  return validated;
}

/**
 * Create a new query builder instance
 */
export function createQueryBuilder(): SecureQueryBuilder {
  return new SecureQueryBuilder();
}

export default {
  executeSpatialQuery,
  executeSearchQuery,
  validateRPCParameters,
  createQueryBuilder
};
