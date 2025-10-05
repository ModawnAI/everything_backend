/**
 * Database Query Tool
 * Provides Supabase database access via MCP server
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabase;
}

/**
 * Database Query Tool
 * Execute SELECT queries on Supabase
 */
export const dbQueryTool = tool({
  name: 'db-query',
  description: 'Execute SELECT queries on Supabase database. Use this to validate data state after API operations.',
  inputSchema: z.object({
    table: z.string().describe('Table name to query'),
    select: z.string().optional().default('*').describe('Columns to select (e.g., "id,name,email")'),
    filters: z.record(z.any()).optional().describe('Filters as key-value pairs (e.g., {email: "test@example.com"})'),
    orderBy: z.object({
      column: z.string(),
      ascending: z.boolean().optional().default(true)
    }).optional(),
    limit: z.number().optional().describe('Limit number of results'),
    single: z.boolean().optional().default(false).describe('Expect single result')
  }),
  handler: async (input) => {
    try {
      const supabase = getSupabaseClient();
      let query = supabase.from(input.table).select(input.select);

      // Apply filters
      if (input.filters) {
        for (const [key, value] of Object.entries(input.filters)) {
          query = query.eq(key, value);
        }
      }

      // Apply ordering
      if (input.orderBy) {
        query = query.order(input.orderBy.column, { ascending: input.orderBy.ascending });
      }

      // Apply limit
      if (input.limit) {
        query = query.limit(input.limit);
      }

      // Execute query
      const { data, error } = input.single ? await query.single() : await query;

      if (error) {
        logger.error('Database query failed', {
          table: input.table,
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      logger.info('Database query successful', {
        table: input.table,
        count: Array.isArray(data) ? data.length : 1
      });

      return {
        success: true,
        data,
        count: Array.isArray(data) ? data.length : 1
      };
    } catch (error: any) {
      logger.error('Database query exception', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * Database Insert Tool
 * Insert data into Supabase (for test data creation)
 */
export const dbInsertTool = tool({
  name: 'db-insert',
  description: 'Insert test data into Supabase database',
  inputSchema: z.object({
    table: z.string().describe('Table name'),
    data: z.any().describe('Data to insert (single object or array)'),
    returning: z.boolean().optional().default(true).describe('Return inserted data')
  }),
  handler: async (input) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from(input.table)
        .insert(input.data)
        .select();

      if (error) {
        logger.error('Database insert failed', {
          table: input.table,
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      logger.info('Database insert successful', {
        table: input.table,
        count: Array.isArray(data) ? data.length : 1
      });

      return {
        success: true,
        data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * Database Update Tool
 */
export const dbUpdateTool = tool({
  name: 'db-update',
  description: 'Update data in Supabase database',
  inputSchema: z.object({
    table: z.string().describe('Table name'),
    filters: z.record(z.any()).describe('Filters to match records (e.g., {id: "123"})'),
    updates: z.record(z.any()).describe('Fields to update'),
    returning: z.boolean().optional().default(true)
  }),
  handler: async (input) => {
    try {
      const supabase = getSupabaseClient();
      let query = supabase.from(input.table).update(input.updates);

      // Apply filters
      for (const [key, value] of Object.entries(input.filters)) {
        query = query.eq(key, value);
      }

      const { data, error } = input.returning ? await query.select() : await query;

      if (error) {
        logger.error('Database update failed', {
          table: input.table,
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * Database Delete Tool
 */
export const dbDeleteTool = tool({
  name: 'db-delete',
  description: 'Delete data from Supabase database (use with caution)',
  inputSchema: z.object({
    table: z.string().describe('Table name'),
    filters: z.record(z.any()).describe('Filters to match records to delete'),
    confirm: z.boolean().describe('Confirmation required (must be true)')
  }),
  handler: async (input) => {
    if (!input.confirm) {
      return {
        success: false,
        error: 'Delete operation requires confirmation (confirm: true)'
      };
    }

    try {
      const supabase = getSupabaseClient();
      let query = supabase.from(input.table).delete();

      // Apply filters
      for (const [key, value] of Object.entries(input.filters)) {
        query = query.eq(key, value);
      }

      const { error } = await query;

      if (error) {
        logger.error('Database delete failed', {
          table: input.table,
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      logger.warn('Database delete successful', {
        table: input.table,
        filters: input.filters
      });

      return {
        success: true,
        message: 'Records deleted successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * Execute RPC Function
 */
export const supabaseRpcTool = tool({
  name: 'supabase-rpc',
  description: 'Execute Supabase RPC (stored procedure) function',
  inputSchema: z.object({
    functionName: z.string().describe('Name of the RPC function'),
    params: z.record(z.any()).optional().describe('Function parameters')
  }),
  handler: async (input) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc(input.functionName, input.params);

      if (error) {
        logger.error('RPC call failed', {
          function: input.functionName,
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});
