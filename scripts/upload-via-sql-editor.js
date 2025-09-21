#!/usr/bin/env node

/**
 * Upload Schema via Supabase SQL Editor
 * 
 * This script splits the schema into smaller chunks and provides instructions
 * for manual upload via the Supabase SQL Editor.
 */

const fs = require('fs');
const path = require('path');

async function splitSchemaForUpload() {
  try {
    console.log('📄 Reading schema file...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'SUPABASE SCHEMA.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📊 Schema file loaded:', `${(schemaSQL.length / 1024).toFixed(1)}KB`);
    
    // Split into logical sections
    const sections = [
      {
        name: '1_extensions_and_enums',
        start: '-- =============================================',
        end: '-- =============================================\n-- 테이블 정의 (TABLE DEFINITIONS)',
        description: 'Extensions, ENUMs, and basic setup'
      },
      {
        name: '2_core_tables',
        start: '-- =============================================\n-- 테이블 정의 (TABLE DEFINITIONS)',
        end: '-- =============================================\n-- 인덱스 (INDEXES)',
        description: 'Core tables (users, shops, services, etc.)'
      },
      {
        name: '3_indexes',
        start: '-- =============================================\n-- 인덱스 (INDEXES)',
        end: '-- =============================================\n-- RLS 정책 (ROW LEVEL SECURITY)',
        description: 'Database indexes for performance'
      },
      {
        name: '4_rls_policies',
        start: '-- =============================================\n-- RLS 정책 (ROW LEVEL SECURITY)',
        end: '-- =============================================\n-- 함수 (FUNCTIONS)',
        description: 'Row Level Security policies'
      },
      {
        name: '5_functions',
        start: '-- =============================================\n-- 함수 (FUNCTIONS)',
        end: '-- =============================================\n-- 뷰 (VIEWS)',
        description: 'Database functions and stored procedures'
      },
      {
        name: '6_views',
        start: '-- =============================================\n-- 뷰 (VIEWS)',
        end: '-- =============================================\n-- 초기 데이터 (INITIAL DATA)',
        description: 'Database views'
      },
      {
        name: '7_initial_data',
        start: '-- =============================================\n-- 초기 데이터 (INITIAL DATA)',
        end: '-- =============================================\n-- 스토리지 버킷 (STORAGE BUCKETS)',
        description: 'Initial data and seed data'
      },
      {
        name: '8_storage',
        start: '-- =============================================\n-- 스토리지 버킷 (STORAGE BUCKETS)',
        end: '-- =============================================\n-- 마무리 (FINALIZATION)',
        description: 'Storage buckets and CDN configuration'
      }
    ];
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'schema-chunks');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('📁 Creating schema chunks...');
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const startIndex = schemaSQL.indexOf(section.start);
      const endIndex = i < sections.length - 1 
        ? schemaSQL.indexOf(sections[i + 1].start)
        : schemaSQL.length;
      
      if (startIndex === -1) {
        console.log(`⚠️  Section ${section.name} not found, skipping...`);
        continue;
      }
      
      const sectionSQL = schemaSQL.substring(startIndex, endIndex).trim();
      
      if (sectionSQL.length === 0) {
        console.log(`⚠️  Section ${section.name} is empty, skipping...`);
        continue;
      }
      
      const filename = `${i + 1}_${section.name}.sql`;
      const filepath = path.join(outputDir, filename);
      
      // Add header comment
      const header = `-- =============================================
-- ${section.description.toUpperCase()}
-- =============================================
-- Upload this file to Supabase SQL Editor
-- File: ${filename}
-- Size: ${(sectionSQL.length / 1024).toFixed(1)}KB
-- =============================================

`;
      
      fs.writeFileSync(filepath, header + sectionSQL);
      
      console.log(`✅ Created ${filename} (${(sectionSQL.length / 1024).toFixed(1)}KB)`);
    }
    
    console.log('\n🎯 Upload Instructions:');
    console.log('1. Go to https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql');
    console.log('2. Upload each file in order (1_ through 8_)');
    console.log('3. Execute each file one by one');
    console.log('4. Check for any errors and resolve them');
    console.log(`\n📁 Files created in: ${outputDir}`);
    
    // Create a master upload script
    const uploadScript = `#!/bin/bash
# Supabase Schema Upload Script
# Run this script to upload schema chunks in order

echo "🚀 Starting Supabase schema upload..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

# Upload each chunk
for file in schema-chunks/*.sql; do
    if [ -f "$file" ]; then
        echo "📤 Uploading $file..."
        supabase db push --file "$file" || {
            echo "❌ Failed to upload $file"
            echo "Please upload manually via SQL Editor: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql"
            exit 1
        }
        echo "✅ $file uploaded successfully"
    fi
done

echo "🎉 Schema upload completed!"
`;
    
    fs.writeFileSync(path.join(outputDir, 'upload.sh'), uploadScript);
    fs.chmodSync(path.join(outputDir, 'upload.sh'), '755');
    
    console.log('\n📝 Alternative: Use the generated upload.sh script');
    console.log('   cd schema-chunks && ./upload.sh');
    
  } catch (error) {
    console.error('💥 Error splitting schema:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  splitSchemaForUpload();
}

module.exports = { splitSchemaForUpload };
