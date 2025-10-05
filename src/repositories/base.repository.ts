/**
 * Base Repository Pattern
 * 
 * Eliminates duplicate database query patterns and provides consistent
 * data access methods across all repositories.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface QueryOptions {
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, any>;
}

export interface PaginationResult<T> {
  data: T[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

export abstract class BaseRepository<T = any> {
  protected supabase: SupabaseClient;
  protected abstract tableName: string;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string, select: string = '*'): Promise<T | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(select)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Record not found
        }
        logger.error(`Failed to find ${this.tableName} by ID`, {
          error: error.message,
          tableName: this.tableName,
          id
        });
        throw new Error(`Failed to find ${this.tableName}: ${error.message}`);
      }

      return data as T;
    } catch (error) {
      logger.error(`Error in findById for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Find multiple records with filtering and pagination
   */
  async findMany(options: QueryOptions = {}): Promise<PaginationResult<T>> {
    try {
      const {
        select = '*',
        limit = 20,
        offset = 0,
        orderBy = { column: 'created_at', ascending: false },
        filters = {}
      } = options;

      let query = this.supabase
        .from(this.tableName)
        .select(select, { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order(orderBy.column, { ascending: orderBy.ascending });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      const { data, error, count } = await query;

      if (error) {
        logger.error(`Failed to find ${this.tableName} records`, {
          error: error.message,
          tableName: this.tableName,
          options
        });
        throw new Error(`Failed to find ${this.tableName} records: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        data: (data || []) as T[],
        totalCount,
        hasMore: offset + limit < totalCount,
        currentPage,
        totalPages
      };
    } catch (error) {
      logger.error(`Error in findMany for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        options
      });
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        logger.error(`Failed to create ${this.tableName}`, {
          error: error.message,
          tableName: this.tableName,
          data
        });
        throw new Error(`Failed to create ${this.tableName}: ${error.message}`);
      }

      logger.info(`${this.tableName} created successfully`, {
        tableName: this.tableName,
        id: (result as any).id
      });

      return result;
    } catch (error) {
      logger.error(`Error in create for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        data
      });
      throw error;
    }
  }

  /**
   * Update an existing record
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error(`Failed to update ${this.tableName}`, {
          error: error.message,
          tableName: this.tableName,
          id,
          data
        });
        throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
      }

      logger.info(`${this.tableName} updated successfully`, {
        tableName: this.tableName,
        id
      });

      return result;
    } catch (error) {
      logger.error(`Error in update for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        id,
        data
      });
      throw error;
    }
  }

  /**
   * Soft delete a record (set status to deleted)
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error(`Failed to soft delete ${this.tableName}`, {
          error: error.message,
          tableName: this.tableName,
          id
        });
        throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
      }

      logger.info(`${this.tableName} soft deleted successfully`, {
        tableName: this.tableName,
        id
      });

      return true;
    } catch (error) {
      logger.error(`Error in softDelete for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Hard delete a record (permanent removal)
   */
  async hardDelete(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        logger.error(`Failed to hard delete ${this.tableName}`, {
          error: error.message,
          tableName: this.tableName,
          id
        });
        throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
      }

      logger.info(`${this.tableName} hard deleted successfully`, {
        tableName: this.tableName,
        id
      });

      return true;
    } catch (error) {
      logger.error(`Error in hardDelete for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error(`Failed to check existence for ${this.tableName}`, {
          error: error.message,
          tableName: this.tableName,
          id
        });
        throw new Error(`Failed to check existence: ${error.message}`);
      }

      return data !== null;
    } catch (error) {
      logger.error(`Error in exists for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Execute custom query with error handling
   */
  protected async executeQuery<R = any>(
    queryBuilder: (client: SupabaseClient) => any,
    operation: string
  ): Promise<R> {
    try {
      const { data, error } = await queryBuilder(this.supabase);

      if (error) {
        logger.error(`Failed to execute ${operation} for ${this.tableName}`, {
          error: error.message,
          tableName: this.tableName,
          operation
        });
        throw new Error(`${operation} failed: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error(`Error in ${operation} for ${this.tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName: this.tableName,
        operation
      });
      throw error;
    }
  }

  /**
   * Execute RPC function with error handling
   */
  protected async executeRPC<R = any>(
    functionName: string,
    parameters: Record<string, any> = {}
  ): Promise<R> {
    try {
      const { data, error } = await this.supabase.rpc(functionName, parameters);

      if (error) {
        logger.error(`RPC function failed: ${functionName}`, {
          error: error.message,
          functionName,
          parameters
        });
        throw new Error(`RPC ${functionName} failed: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error(`Error executing RPC: ${functionName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        functionName,
        parameters
      });
      throw error;
    }
  }
}
