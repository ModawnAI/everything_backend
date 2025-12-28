#!/usr/bin/env node

/**
 * Split Schema into Uploadable Chunks
 */

const fs = require('fs');
const path = require('path');

function splitSchema() {
  try {
    console.log('📄 Reading schema file...');
    
    const schemaPath = path.join(__dirname, '..', 'SUPABASE SCHEMA.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📊 Schema file loaded:', `${(schemaSQL.length / 1024).toFixed(1)}KB`);
    
    // Split by major sections
    const sections = schemaSQL.split(/(?=-- =============================================)/);
    
    console.log(`📝 Found ${sections.length} sections`);
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'schema-chunks');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    let chunkCount = 0;
    const maxChunkSize = 50 * 1024; // 50KB per chunk
    
    for (let i = 0; i < sections.length; i++) {
      let section = sections[i].trim();
      if (!section) continue;
      
      // If section is too large, split it further
      if (section.length > maxChunkSize) {
        const statements = section.split(';').filter(s => s.trim());
        let currentChunk = '';
        let statementCount = 0;
        
        for (const statement of statements) {
          if (currentChunk.length + statement.length > maxChunkSize && currentChunk.length > 0) {
            // Save current chunk
            chunkCount++;
            const filename = `chunk_${chunkCount.toString().padStart(3, '0')}.sql`;
            const filepath = path.join(outputDir, filename);
            
            const header = `-- =============================================
-- SCHEMA CHUNK ${chunkCount}
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: ${(currentChunk.length / 1024).toFixed(1)}KB
-- Statements: ${statementCount}
-- =============================================

`;
            
            fs.writeFileSync(filepath, header + currentChunk + ';');
            console.log(`✅ Created ${filename} (${(currentChunk.length / 1024).toFixed(1)}KB, ${statementCount} statements)`);
            
            // Start new chunk
            currentChunk = statement + ';';
            statementCount = 1;
          } else {
            currentChunk += statement + ';';
            statementCount++;
          }
        }
        
        // Save final chunk
        if (currentChunk.trim()) {
          chunkCount++;
          const filename = `chunk_${chunkCount.toString().padStart(3, '0')}.sql`;
          const filepath = path.join(outputDir, filename);
          
          const header = `-- =============================================
-- SCHEMA CHUNK ${chunkCount}
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: ${(currentChunk.length / 1024).toFixed(1)}KB
-- Statements: ${statementCount}
-- =============================================

`;
          
          fs.writeFileSync(filepath, header + currentChunk);
          console.log(`✅ Created ${filename} (${(currentChunk.length / 1024).toFixed(1)}KB, ${statementCount} statements)`);
        }
      } else {
        // Section is small enough, save as single chunk
        chunkCount++;
        const filename = `chunk_${chunkCount.toString().padStart(3, '0')}.sql`;
        const filepath = path.join(outputDir, filename);
        
        const header = `-- =============================================
-- SCHEMA CHUNK ${chunkCount}
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: ${(section.length / 1024).toFixed(1)}KB
-- =============================================

`;
        
        fs.writeFileSync(filepath, header + section);
        console.log(`✅ Created ${filename} (${(section.length / 1024).toFixed(1)}KB)`);
      }
    }
    
    console.log(`\n🎯 Upload Instructions:`);
    console.log(`1. Go to https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql`);
    console.log(`2. Upload and execute each chunk in order (chunk_001.sql through chunk_${chunkCount.toString().padStart(3, '0')}.sql)`);
    console.log(`3. Check for any errors and resolve them`);
    console.log(`\n📁 Files created in: ${outputDir}`);
    
    // Create upload instructions
    const instructions = `# Supabase Schema Upload Instructions

## Method 1: Supabase SQL Editor (Recommended)
1. Go to https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql
2. Upload and execute each file in order:
   - chunk_001.sql
   - chunk_002.sql
   - ... (continue in order)
   - chunk_${chunkCount.toString().padStart(3, '0')}.sql
3. Check for any errors and resolve them

## Method 2: Supabase CLI (if password works)
\`\`\`bash
cd schema-chunks
for file in chunk_*.sql; do
  echo "Uploading $file..."
  supabase db push --file "$file"
done
\`\`\`

## Method 3: Manual Copy-Paste
1. Open each chunk file
2. Copy the SQL content (excluding the header comments)
3. Paste into Supabase SQL Editor
4. Execute and check for errors

## Files to Upload (${chunkCount} total):
${Array.from({length: chunkCount}, (_, i) => `- chunk_${(i + 1).toString().padStart(3, '0')}.sql`).join('\n')}
`;
    
    fs.writeFileSync(path.join(outputDir, 'README.md'), instructions);
    
  } catch (error) {
    console.error('💥 Error splitting schema:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  splitSchema();
}

module.exports = { splitSchema };
