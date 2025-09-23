#!/usr/bin/env node

/**
 * Generate Migration SQL for Supabase SQL Editor
 * 
 * This script reads the migration file and outputs it in a format
 * that can be easily copied to the Supabase SQL editor.
 */

const fs = require('fs');
const path = require('path');

function generateMigrationSQL() {
  try {
    console.log('📄 Generating migration SQL for Supabase SQL Editor...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'src', 'migrations', '068_database_performance_optimization.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📏 Migration file loaded successfully');
    console.log(`📏 Migration size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

    // Split migration into parts for easier execution
    const part1Start = migrationSQL.indexOf('-- PART 1: ADD MISSING FOREIGN KEY INDEXES');
    const part1End = migrationSQL.indexOf('-- PART 2: REMOVE UNUSED INDEXES');
    const part1SQL = migrationSQL.substring(part1Start, part1End);

    const part2Start = migrationSQL.indexOf('-- PART 2: REMOVE UNUSED INDEXES');
    const part2End = migrationSQL.indexOf('-- PART 3: PERFORMANCE VALIDATION QUERIES');
    const part2SQL = migrationSQL.substring(part2Start, part2End);

    // Create output directory
    const outputDir = path.join(__dirname, '..', 'migration-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write Part 1 (Foreign Key Indexes)
    const part1Path = path.join(outputDir, 'part1_foreign_key_indexes.sql');
    fs.writeFileSync(part1Path, part1SQL);
    console.log(`✅ Part 1 (Foreign Key Indexes) saved to: ${part1Path}`);

    // Write Part 2 (Remove Unused Indexes)
    const part2Path = path.join(outputDir, 'part2_remove_unused_indexes.sql');
    fs.writeFileSync(part2Path, part2SQL);
    console.log(`✅ Part 2 (Remove Unused Indexes) saved to: ${part2Path}`);

    // Write complete migration
    const completePath = path.join(outputDir, 'complete_migration.sql');
    fs.writeFileSync(completePath, migrationSQL);
    console.log(`✅ Complete migration saved to: ${completePath}`);

    console.log('\n📋 Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of one of the generated files');
    console.log('4. Execute the SQL');
    console.log('5. Repeat for each part if needed');
    console.log('\n💡 Recommended execution order:');
    console.log('   - First: part1_foreign_key_indexes.sql');
    console.log('   - Second: part2_remove_unused_indexes.sql');
    console.log('   - Or: complete_migration.sql (all at once)');

    console.log('\n🎯 Migration files ready for Supabase SQL Editor!');

  } catch (error) {
    console.error('❌ Error generating migration SQL:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateMigrationSQL();
