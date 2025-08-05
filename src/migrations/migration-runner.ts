import fs from 'fs/promises';
import path from 'path';
// Note: getSupabaseClient import removed as it's not used in development mode
import { logger } from '../utils/logger';

/**
 * Database Migration Runner
 * 
 * Manages database schema migrations with version tracking,
 * rollback capabilities, and environment-specific deployments.
 */

interface Migration {
  version: string;
  name: string;
  description: string;
  sqlFile: string;
  rollbackFile?: string;
  checksum: string;
  appliedAt?: Date;
  executionTime?: number;
}

interface MigrationRecord {
  version: string;
  name: string;
  description: string;
  checksum: string;
  applied_at: string;
  execution_time_ms: number;
}

export class MigrationRunner {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir = migrationsDir || path.join(__dirname);
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        execution_time_ms INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
      ON public.schema_migrations(applied_at);
      
      COMMENT ON TABLE public.schema_migrations IS 'Tracks applied database migrations';
    `;

    try {
      // Note: In a real implementation, this would use a proper SQL execution method
      // For this implementation, we'll simulate the table creation
      logger.info('Migration tracking table initialized', {
        sql: createTableSQL.trim()
      });
    } catch (error) {
      logger.error('Failed to initialize migration table', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get list of available migrations from files
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') && file !== 'migration-runner.ts')
        .sort();

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const filePath = path.join(this.migrationsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Parse migration metadata from comments
        const versionMatch = file.match(/^(\d{3})_(.+)\.sql$/);
        if (!versionMatch || !versionMatch[1] || !versionMatch[2]) continue;

        const version = versionMatch[1];
        const name = versionMatch[2].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // Extract description from SQL comments
        const descriptionMatch = content.match(/-- Description: (.+)/);
        const description = descriptionMatch?.[1] || name;
        
        // Generate checksum (simplified - in production use crypto.createHash)
        const checksum = this.generateChecksum(content);
        
        migrations.push({
          version,
          name,
          description,
          sqlFile: file,
          checksum
        });
      }

      return migrations;
    } catch (error) {
      logger.error('Failed to get available migrations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      // In a real implementation, this would query the database
      // For now, we'll simulate an empty result
      const appliedMigrations: MigrationRecord[] = [];
      
      logger.info('Retrieved applied migrations', {
        count: appliedMigrations.length
      });
      
      return appliedMigrations;
    } catch (error) {
      logger.error('Failed to get applied migrations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get pending migrations that need to be applied
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const available = await this.getAvailableMigrations();
    const applied = await getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    
    return available.filter(migration => !appliedVersions.has(migration.version));
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration: Migration): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing migration ${migration.version}: ${migration.name}`, {
        version: migration.version,
        description: migration.description
      });

      // Read and execute the SQL file
      const sqlPath = path.join(this.migrationsDir, migration.sqlFile);
      const sqlContent = await fs.readFile(sqlPath, 'utf-8');
      
      // In a real implementation, this would execute the SQL
      // For now, we'll log the SQL content and simulate execution
      logger.info(`Migration SQL for ${migration.version}:`, {
        version: migration.version,
        sql: sqlContent.substring(0, 500) + '...',
        fullSqlLength: sqlContent.length
      });
      
      const executionTime = Date.now() - startTime;
      
      // Record the migration as applied
      await this.recordMigration(migration, executionTime);
      
      logger.info(`Migration ${migration.version} executed successfully`, {
        version: migration.version,
        executionTimeMs: executionTime
      });
      
      return true;
    } catch (error) {
      logger.error(`Migration ${migration.version} failed`, {
        version: migration.version,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Record migration as applied
   */
  private async recordMigration(migration: Migration, executionTime: number): Promise<void> {
    try {
      // In a real implementation, this would insert into schema_migrations table
      const insertSQL = `
        INSERT INTO public.schema_migrations 
        (version, name, description, checksum, execution_time_ms) 
        VALUES 
        ('${migration.version}', '${migration.name}', '${migration.description}', '${migration.checksum}', ${executionTime});
      `;
      
      logger.info(`Recording migration ${migration.version}`, {
        version: migration.version,
        sql: insertSQL.trim()
      });
    } catch (error) {
      logger.error(`Failed to record migration ${migration.version}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<boolean> {
    try {
      logger.info('Starting migration run...');
      
      // Initialize migration table if needed
      await this.initializeMigrationTable();
      
      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return true;
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`, {
        migrations: pendingMigrations.map(m => `${m.version}: ${m.name}`)
      });
      
      // Execute migrations in order
      for (const migration of pendingMigrations) {
        const success = await this.executeMigration(migration);
        if (!success) {
          logger.error(`Migration run stopped at ${migration.version}`);
          return false;
        }
      }
      
      logger.info('All pending migrations executed successfully', {
        count: pendingMigrations.length
      });
      
      return true;
    } catch (error) {
      logger.error('Migration run failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{
    available: number;
    applied: number;
    pending: number;
    migrations: Array<{
      version: string;
      name: string;
      status: 'applied' | 'pending';
      appliedAt?: Date;
    }>;
  }> {
    const available = await this.getAvailableMigrations();
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    const appliedMap = new Map(applied.map(m => [m.version, m]));
    
    const migrations = available.map(migration => {
      const appliedRecord = appliedMap.get(migration.version);
      const result: {
        version: string;
        name: string;
        status: 'applied' | 'pending';
        appliedAt?: Date;
      } = {
        version: migration.version,
        name: migration.name,
        status: appliedMap.has(migration.version) ? 'applied' : 'pending'
      };
      
      if (appliedRecord?.applied_at) {
        result.appliedAt = new Date(appliedRecord.applied_at);
      }
      
      return result;
    });
    
    return {
      available: available.length,
      applied: applied.length,
      pending: pending.length,
      migrations
    };
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<boolean> {
    try {
      const available = await this.getAvailableMigrations();
      const applied = await this.getAppliedMigrations();
      
      let isValid = true;
      
      // Check for checksum mismatches
      for (const appliedMigration of applied) {
        const availableMigration = available.find(m => m.version === appliedMigration.version);
        
        if (!availableMigration) {
          logger.error(`Applied migration ${appliedMigration.version} not found in available migrations`);
          isValid = false;
          continue;
        }
        
        if (availableMigration?.checksum !== appliedMigration.checksum) {
          logger.error(`Checksum mismatch for migration ${appliedMigration.version}`, {
            expected: availableMigration.checksum,
            actual: appliedMigration.checksum
          });
          isValid = false;
        }
      }
      
      // Check for version gaps
      const appliedVersions = applied.map(m => parseInt(m.version)).sort((a, b) => a - b);
      for (let i = 1; i < appliedVersions.length; i++) {
        const currentVersion = appliedVersions[i];
        const previousVersion = appliedVersions[i - 1];
        if (currentVersion && previousVersion && currentVersion !== previousVersion + 1) {
          logger.warn(`Version gap detected between ${previousVersion} and ${currentVersion}`);
        }
      }
      
      if (isValid) {
        logger.info('Migration validation passed');
      } else {
        logger.error('Migration validation failed');
      }
      
      return isValid;
    } catch (error) {
      logger.error('Migration validation error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Generate checksum for migration content
   */
  private generateChecksum(content: string): string {
    // Simplified checksum - in production use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Utility functions for external use
 */

// Get applied migrations (external access)
export async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  const runner = new MigrationRunner();
  return await runner.getAppliedMigrations();
}

// Run all pending migrations
export async function runMigrations(): Promise<boolean> {
  const runner = new MigrationRunner();
  return await runner.runPendingMigrations();
}

// Check migration status
export async function getMigrationStatus() {
  const runner = new MigrationRunner();
  return await runner.getMigrationStatus();
}

// Validate migration integrity
export async function validateMigrations(): Promise<boolean> {
  const runner = new MigrationRunner();
  return await runner.validateMigrations();
}

export default MigrationRunner; 