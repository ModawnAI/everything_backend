#!/usr/bin/env node

/**
 * Automatic Schema Upload Script
 * 
 * This script automatically uploads all schema chunks to Supabase
 * using the Supabase CLI with the provided database password.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DATABASE_PASSWORD = 'Bukhard@1';
const PROJECT_REF = 'ysrudwzwnzxrrwjtpuoh';
const CHUNKS_DIR = path.join(__dirname, '..', 'schema-chunks');

async function uploadSchemaChunks() {
  try {
    console.log('🚀 Starting automatic schema upload...');
    console.log('📡 Project:', PROJECT_REF);
    console.log('📁 Chunks directory:', CHUNKS_DIR);
    
    // Check if chunks directory exists
    if (!fs.existsSync(CHUNKS_DIR)) {
      throw new Error('Schema chunks directory not found. Please run the split-schema script first.');
    }
    
    // Get all chunk files and sort them
    const chunkFiles = fs.readdirSync(CHUNKS_DIR)
      .filter(file => file.startsWith('chunk_') && file.endsWith('.sql'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/chunk_(\d+)\.sql/)[1]);
        const bNum = parseInt(b.match(/chunk_(\d+)\.sql/)[1]);
        return aNum - bNum;
      });
    
    console.log(`📝 Found ${chunkFiles.length} chunk files to upload`);
    
    // Upload each chunk
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkFile = chunkFiles[i];
      const chunkPath = path.join(CHUNKS_DIR, chunkFile);
      const chunkNumber = i + 1;
      
      console.log(`\n📤 Uploading ${chunkFile} (${chunkNumber}/${chunkFiles.length})...`);
      
      try {
        // Use supabase db push with the specific file
        const command = `supabase db push --file "${chunkPath}" --db-url "postgresql://postgres.${PROJECT_REF}:${DATABASE_PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"`;
        
        console.log(`   Executing: ${command.replace(DATABASE_PASSWORD, '***')}`);
        
        const output = execSync(command, { 
          encoding: 'utf8',
          timeout: 60000, // 60 second timeout per chunk
          stdio: 'pipe'
        });
        
        console.log(`   ✅ ${chunkFile} uploaded successfully`);
        successCount++;
        
        // Small delay between uploads
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ ${chunkFile} failed:`, error.message);
        errors.push({ file: chunkFile, error: error.message });
        errorCount++;
        
        // Ask if user wants to continue
        console.log(`   ⚠️  Continuing with next chunk...`);
      }
    }
    
    // Summary
    console.log('\n📊 Upload Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${chunkFiles.length}`);
    
    if (errorCount > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ file, error }) => {
        console.log(`   - ${file}: ${error}`);
      });
      
      console.log('\n💡 You can manually upload failed chunks via Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql');
    }
    
    if (successCount === chunkFiles.length) {
      console.log('\n🎉 All schema chunks uploaded successfully!');
      console.log('🔗 Check your Supabase dashboard to verify the schema was applied correctly.');
    } else if (successCount > 0) {
      console.log('\n⚠️  Partial upload completed. Please check the errors above.');
    } else {
      console.log('\n💥 Upload failed completely. Please check your connection and credentials.');
    }
    
  } catch (error) {
    console.error('💥 Upload script failed:', error.message);
    process.exit(1);
  }
}

// Alternative method using interactive CLI
async function uploadWithInteractiveCLI() {
  try {
    console.log('🔄 Trying interactive CLI method...');
    
    // Get all chunk files
    const chunkFiles = fs.readdirSync(CHUNKS_DIR)
      .filter(file => file.startsWith('chunk_') && file.endsWith('.sql'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/chunk_(\d+)\.sql/)[1]);
        const bNum = parseInt(b.match(/chunk_(\d+)\.sql/)[1]);
        return aNum - bNum;
      });
    
    console.log(`📝 Found ${chunkFiles.length} chunk files to upload`);
    
    // Create a combined SQL file for easier upload
    const combinedPath = path.join(CHUNKS_DIR, 'combined_schema.sql');
    let combinedSQL = '';
    
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(CHUNKS_DIR, chunkFile);
      const chunkSQL = fs.readFileSync(chunkPath, 'utf8');
      
      // Remove header comments and add chunk separator
      const cleanSQL = chunkSQL
        .split('\n')
        .filter(line => !line.trim().startsWith('-- ============================================='))
        .filter(line => !line.trim().startsWith('-- Upload this file'))
        .filter(line => !line.trim().startsWith('-- Size:'))
        .filter(line => !line.trim().startsWith('-- Statements:'))
        .join('\n')
        .trim();
      
      if (cleanSQL) {
        combinedSQL += `\n-- =============================================\n-- CHUNK: ${chunkFile}\n-- =============================================\n\n${cleanSQL}\n\n`;
      }
    }
    
    fs.writeFileSync(combinedPath, combinedSQL);
    console.log(`📄 Created combined schema file: ${combinedPath}`);
    console.log(`📊 Combined size: ${(combinedSQL.length / 1024).toFixed(1)}KB`);
    
    console.log('\n🎯 Next steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql');
    console.log('2. Upload the combined file: schema-chunks/combined_schema.sql');
    console.log('3. Execute the SQL and check for errors');
    
  } catch (error) {
    console.error('💥 Interactive CLI method failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    // Try automatic upload first
    await uploadSchemaChunks();
  } catch (error) {
    console.log('\n🔄 Automatic upload failed, trying alternative method...');
    await uploadWithInteractiveCLI();
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadSchemaChunks, uploadWithInteractiveCLI };
