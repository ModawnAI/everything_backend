#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '../src/migrations');
const DATABASE_FUNCTIONS_DIR = path.join(__dirname, '../database/functions');

class MigrationRunner {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async runMigrations() {
    console.log('🚀 Starting database migrations...\n');

    // Check if required environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing required environment variables:');
      console.error('   - SUPABASE_URL');
      console.error('   - SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }

    try {
      // Test database connection
      console.log('🔍 Testing database connection...');
      const { error: connectionError } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (connectionError && connectionError.code !== 'PGRST116') {
        throw new Error(`Database connection failed: ${connectionError.message}`);
      }
      console.log('✅ Database connection successful\n');

      // Run migrations in order
      const migrationFiles = this.getMigrationFiles();
      console.log(`📋 Found ${migrationFiles.length} migration files\n`);

      for (const migrationFile of migrationFiles) {
        await this.runMigration(migrationFile);
      }

      // Run database functions
      console.log('\n🔧 Running database functions...');
      await this.runDatabaseFunctions();

      console.log('\n🎉 All migrations completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    }
  }

  getMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically to ensure correct order
    
    return files.map(file => ({
      name: file,
      path: path.join(MIGRATIONS_DIR, file)
    }));
  }

  async runMigration(migrationFile) {
    console.log(`📝 Running migration: ${migrationFile.name}`);
    
    try {
      const sql = fs.readFileSync(migrationFile.path, 'utf8');
      
      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await this.supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            // Some errors are expected (like "already exists")
            if (!error.message.includes('already exists') && 
                !error.message.includes('does not exist') &&
                !error.message.includes('relation') &&
                !error.message.includes('function')) {
              throw new Error(`SQL execution failed: ${error.message}\nStatement: ${statement}`);
            }
          }
        }
      }
      
      console.log(`✅ Migration ${migrationFile.name} completed`);
      
    } catch (error) {
      console.error(`❌ Migration ${migrationFile.name} failed:`, error.message);
      throw error;
    }
  }

  async runDatabaseFunctions() {
    if (!fs.existsSync(DATABASE_FUNCTIONS_DIR)) {
      console.log('⚠️  Database functions directory not found, skipping...');
      return;
    }

    const functionFiles = fs.readdirSync(DATABASE_FUNCTIONS_DIR)
      .filter(file => file.endsWith('.sql'));

    for (const functionFile of functionFiles) {
      console.log(`🔧 Installing function: ${functionFile}`);
      
      try {
        const sql = fs.readFileSync(path.join(DATABASE_FUNCTIONS_DIR, functionFile), 'utf8');
        
        const { error } = await this.supabase.rpc('exec_sql', {
          sql: sql
        });
        
        if (error) {
          if (!error.message.includes('already exists') && 
              !error.message.includes('does not exist')) {
            throw new Error(`Function installation failed: ${error.message}`);
          }
        }
        
        console.log(`✅ Function ${functionFile} installed`);
        
      } catch (error) {
        console.error(`❌ Function ${functionFile} installation failed:`, error.message);
        throw error;
      }
    }
  }

  async checkTables() {
    console.log('\n🔍 Checking created tables...');
    
    const tablesToCheck = [
      'users',
      'shops', 
      'shop_services',
      'reservations',
      'reservation_services',
      'point_transactions',
      'reservation_status_logs'
    ];

    for (const table of tablesToCheck) {
      try {
        const { error } = await this.supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`⚠️  Table ${table}: Not found (${error.message})`);
        } else {
          console.log(`✅ Table ${table}: Exists`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: Error checking (${err.message})`);
      }
    }
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.runMigrations()
    .then(() => runner.checkTables())
    .catch(error => {
      console.error('Migration runner failed:', error);
      process.exit(1);
    });
}

module.exports = MigrationRunner;
