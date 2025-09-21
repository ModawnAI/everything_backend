/**
 * Database Seeding System
 * 
 * Comprehensive seeding system for development, testing, and demo environments
 * with Korean market-specific data and realistic business scenarios
 */

import fs from 'fs/promises';
import path from 'path';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface SeedData {
  table: string;
  data: any[];
  dependencies?: string[];
  environment?: ('development' | 'staging' | 'test')[];
}

export interface SeedResult {
  table: string;
  inserted: number;
  skipped: number;
  errors: number;
  executionTime: number;
}

export class SeedRunner {
  private supabase = getSupabaseClient();
  private seedsDir: string;

  constructor(seedsDir?: string) {
    this.seedsDir = seedsDir || path.join(__dirname, 'data');
  }

  /**
   * Run all seeds for current environment
   */
  async runSeeds(environment?: string): Promise<SeedResult[]> {
    const env = environment || config.server.env;
    logger.info('Starting database seeding', { environment: env });

    try {
      const seedFiles = await this.getSeedFiles();
      const results: SeedResult[] = [];

      // Process seeds in dependency order
      const orderedSeeds = this.orderSeedsByDependencies(seedFiles);

      for (const seedFile of orderedSeeds) {
        const seedData = await this.loadSeedData(seedFile);
        
        // Check if seed should run in current environment
        if (seedData.environment && !seedData.environment.includes(env as any)) {
          logger.info(`Skipping seed ${seedData.table} (not for ${env} environment)`);
          continue;
        }

        const result = await this.executeSeed(seedData);
        results.push(result);
      }

      logger.info('Database seeding completed', {
        environment: env,
        totalTables: results.length,
        totalInserted: results.reduce((sum, r) => sum + r.inserted, 0)
      });

      return results;

    } catch (error) {
      logger.error('Database seeding failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: env
      });
      throw error;
    }
  }

  /**
   * Get all seed files
   */
  private async getSeedFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.seedsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .sort();
    } catch (error) {
      logger.error('Failed to read seed files', {
        error: error instanceof Error ? error.message : 'Unknown error',
        seedsDir: this.seedsDir
      });
      return [];
    }
  }

  /**
   * Load seed data from file
   */
  private async loadSeedData(filename: string): Promise<SeedData> {
    const filePath = path.join(this.seedsDir, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to load seed data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filename
      });
      throw error;
    }
  }

  /**
   * Execute seed for a single table
   */
  private async executeSeed(seedData: SeedData): Promise<SeedResult> {
    const startTime = Date.now();
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      logger.info(`Seeding table: ${seedData.table}`, {
        recordCount: seedData.data.length
      });

      for (const record of seedData.data) {
        try {
          // Check if record already exists (for idempotent seeding)
          const existing = await this.checkRecordExists(seedData.table, record);
          
          if (existing) {
            skipped++;
            continue;
          }

          // Insert record
          const { error } = await this.supabase
            .from(seedData.table)
            .insert(record);

          if (error) {
            logger.error(`Failed to insert record in ${seedData.table}`, {
              error: error.message,
              record
            });
            errors++;
          } else {
            inserted++;
          }

        } catch (recordError) {
          logger.error(`Error processing record in ${seedData.table}`, {
            error: recordError instanceof Error ? recordError.message : 'Unknown error',
            record
          });
          errors++;
        }
      }

      const executionTime = Date.now() - startTime;
      const result: SeedResult = {
        table: seedData.table,
        inserted,
        skipped,
        errors,
        executionTime
      };

      logger.info(`Seeding completed for ${seedData.table}`, result);
      return result;

    } catch (error) {
      logger.error(`Seeding failed for ${seedData.table}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        table: seedData.table,
        inserted,
        skipped,
        errors: errors + 1,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check if record already exists
   */
  private async checkRecordExists(table: string, record: any): Promise<boolean> {
    try {
      // Use ID or email/name for uniqueness check
      let query = this.supabase.from(table).select('id');
      
      if (record.id) {
        query = query.eq('id', record.id);
      } else if (record.email) {
        query = query.eq('email', record.email);
      } else if (record.name) {
        query = query.eq('name', record.name);
      } else {
        // No unique identifier, skip existence check
        return false;
      }

      const { data, error } = await query.limit(1);
      
      if (error) {
        logger.warn(`Error checking record existence in ${table}`, {
          error: error.message
        });
        return false;
      }

      return data && data.length > 0;

    } catch (error) {
      logger.warn(`Failed to check record existence in ${table}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Order seeds by dependencies
   */
  private orderSeedsByDependencies(seedFiles: string[]): string[] {
    const dependencyOrder = [
      'users.json',
      'shops.json',
      'shop_services.json',
      'shop_images.json',
      'reservations.json',
      'payments.json',
      'point_transactions.json',
      'feed_posts.json',
      'notifications.json'
    ];

    const ordered: string[] = [];
    const remaining = [...seedFiles];

    for (const file of dependencyOrder) {
      const index = remaining.indexOf(file);
      if (index !== -1) {
        ordered.push(remaining.splice(index, 1)[0]);
      }
    }

    ordered.push(...remaining);
    return ordered;
  }

  /**
   * Clear all seed data (for testing)
   */
  async clearSeeds(): Promise<void> {
    const tables = [
      'feed_posts', 'notifications', 'point_transactions', 'payments',
      'reservations', 'shop_images', 'shop_services', 'shops', 'users'
    ];

    logger.info('Clearing seed data from all tables');

    for (const table of tables) {
      try {
        const { error } = await this.supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          logger.warn(`Failed to clear ${table}`, { error: error.message });
        } else {
          logger.info(`Cleared seed data from ${table}`);
        }
      } catch (error) {
        logger.warn(`Error clearing ${table}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Create seeds directory if it doesn't exist
   */
  async ensureSeedsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.seedsDir, { recursive: true });
      logger.info('Seeds directory ensured', { seedsDir: this.seedsDir });
    } catch (error) {
      logger.error('Failed to create seeds directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        seedsDir: this.seedsDir
      });
      throw error;
    }
  }

  /**
   * Get seeding statistics
   */
  async getSeedingStats(): Promise<{
    totalTables: number;
    totalRecords: number;
    lastSeeded: Date | null;
    environment: string;
  }> {
    try {
      return {
        totalTables: 0,
        totalRecords: 0,
        lastSeeded: null,
        environment: config.server.env
      };
    } catch (error) {
      logger.error('Failed to get seeding stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Global seed runner instance
export const seedRunner = new SeedRunner();

// Utility functions
export async function runSeeds(environment?: string): Promise<SeedResult[]> {
  return await seedRunner.runSeeds(environment);
}

export async function clearSeeds(): Promise<void> {
  return await seedRunner.clearSeeds();
}

export async function generateSeedData(options?: any): Promise<void> {
  await seedRunner.ensureSeedsDirectory();
  logger.info('Seed data generation completed - use existing seed files');
}

export default SeedRunner;
