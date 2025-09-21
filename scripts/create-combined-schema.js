#!/usr/bin/env node

/**
 * Create Combined Schema for Easy Upload
 */

const fs = require('fs');
const path = require('path');

function createCombinedSchema() {
  try {
    console.log('📄 Creating combined schema file...');
    
    const chunksDir = path.join(__dirname, '..', 'schema-chunks');
    
    // Get all chunk files and sort them
    const chunkFiles = fs.readdirSync(chunksDir)
      .filter(file => file.startsWith('chunk_') && file.endsWith('.sql'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/chunk_(\d+)\.sql/)[1]);
        const bNum = parseInt(b.match(/chunk_(\d+)\.sql/)[1]);
        return aNum - bNum;
      });
    
    console.log(`📝 Found ${chunkFiles.length} chunk files to combine`);
    
    let combinedSQL = `-- =============================================
-- COMBINED SUPABASE SCHEMA v3.3
-- =============================================
-- This file contains the complete database schema
-- Upload this single file to Supabase SQL Editor
-- Generated from ${chunkFiles.length} individual chunks
-- =============================================

`;
    
    let totalSize = 0;
    
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkFile = chunkFiles[i];
      const chunkPath = path.join(chunksDir, chunkFile);
      const chunkSQL = fs.readFileSync(chunkPath, 'utf8');
      
      // Remove header comments and add chunk separator
      const cleanSQL = chunkSQL
        .split('\n')
        .filter(line => !line.trim().startsWith('-- ============================================='))
        .filter(line => !line.trim().startsWith('-- Upload this file'))
        .filter(line => !line.trim().startsWith('-- Size:'))
        .filter(line => !line.trim().startsWith('-- Statements:'))
        .filter(line => !line.trim().startsWith('-- CHUNK:'))
        .join('\n')
        .trim();
      
      if (cleanSQL) {
        combinedSQL += `-- =============================================
-- CHUNK ${i + 1}/${chunkFiles.length}: ${chunkFile}
-- =============================================

${cleanSQL}

`;
        totalSize += cleanSQL.length;
      }
    }
    
    // Write combined file
    const combinedPath = path.join(chunksDir, 'combined_schema.sql');
    fs.writeFileSync(combinedPath, combinedSQL);
    
    console.log(`✅ Combined schema created: ${combinedPath}`);
    console.log(`📊 Total size: ${(combinedSQL.length / 1024).toFixed(1)}KB`);
    console.log(`📝 Combined from ${chunkFiles.length} chunks`);
    
    // Create upload instructions
    const instructions = `# 🚀 Supabase Schema Upload Instructions

## ✅ Ready to Upload!

I've created a **single combined schema file** that contains everything you need to upload to Supabase.

### 📁 File to Upload:
\`schema-chunks/combined_schema.sql\` (${(combinedSQL.length / 1024).toFixed(1)}KB)

### 🎯 Upload Steps:

1. **Go to Supabase SQL Editor:**
   https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql

2. **Upload the combined file:**
   - Click "Upload SQL file" or drag & drop
   - Select: \`schema-chunks/combined_schema.sql\`
   - Click "Run" to execute

3. **Check for errors:**
   - Review any error messages
   - Fix any issues if they appear
   - Re-run if necessary

### 📋 What's Included:
- ✅ All database tables and relationships
- ✅ ENUMs and custom types
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Database functions and stored procedures
- ✅ Views and materialized views
- ✅ Initial seed data
- ✅ Storage bucket configurations
- ✅ Enhanced reservation system with locking
- ✅ Shop capacity management infrastructure
- ✅ CDN integration and image optimization
- ✅ Moderation system and security features

### 🔧 Alternative: Manual Copy-Paste
If file upload doesn't work, you can:
1. Open \`schema-chunks/combined_schema.sql\`
2. Copy all the SQL content
3. Paste into the SQL Editor
4. Execute

### 📞 Need Help?
If you encounter any errors during upload, please share the error message and I can help you resolve it.

---
*Generated on ${new Date().toISOString()}*
`;
    
    fs.writeFileSync(path.join(chunksDir, 'UPLOAD_INSTRUCTIONS.md'), instructions);
    
    console.log('\n🎯 Upload Instructions:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql');
    console.log('2. Upload: schema-chunks/combined_schema.sql');
    console.log('3. Execute and check for errors');
    console.log('\n📄 Detailed instructions: schema-chunks/UPLOAD_INSTRUCTIONS.md');
    
  } catch (error) {
    console.error('💥 Error creating combined schema:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  createCombinedSchema();
}

module.exports = { createCombinedSchema };
