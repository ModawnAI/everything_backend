#!/usr/bin/env node

/**
 * Simple migration runner for refresh_tokens table
 */

const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationFile = path.join(__dirname, 'src/migrations/025_create_refresh_tokens_table.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

console.log('Migration SQL loaded successfully');
console.log('Migration file:', migrationFile);
console.log('SQL length:', migrationSQL.length, 'characters');

// For now, just show that the migration is ready
console.log('\n✅ Refresh tokens migration is ready to be applied');
console.log('📋 Migration includes:');
console.log('   - refresh_tokens table with proper indexes');
console.log('   - RLS policies for security');
console.log('   - Helper functions for token management');
console.log('   - Audit logging integration');
console.log('\n🔧 To apply this migration:');
console.log('   1. Connect to your Supabase database');
console.log('   2. Run the SQL from: src/migrations/025_create_refresh_tokens_table.sql');
console.log('   3. Verify the table was created successfully');
