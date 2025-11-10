#!/usr/bin/env ts-node
/**
 * Insert shops in batches
 * Splits the large dataset into manageable chunks for Supabase MCP
 */

import * as fs from 'fs';
import * as path from 'path';

interface ShopData {
  id: string;
  name: string;
  address: string;
  phone_number: string;
  latitude: number;
  longitude: number;
  main_category: string;
  sub_categories: string[] | null;
  shop_type: string;
  shop_status: string;
  verification_status: string;
  commission_rate: number;
  total_bookings: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

function generateInsertSQL(shops: ShopData[]): string {
  const values = shops.map(shop => {
    const subCategoriesStr = shop.sub_categories
      ? `ARRAY[${shop.sub_categories.map(c => `'${c}'::service_category`).join(',')}]`
      : 'NULL';

    return `(
      '${shop.id}'::uuid,
      '${shop.name.replace(/'/g, "''")}'::varchar,
      '${shop.address.replace(/'/g, "''")}'::text,
      '${shop.phone_number}'::varchar,
      ${shop.latitude}::numeric,
      ${shop.longitude}::numeric,
      ST_SetSRID(ST_MakePoint(${shop.longitude}, ${shop.latitude}), 4326)::geography,
      '${shop.main_category}'::service_category,
      ${subCategoriesStr},
      '${shop.shop_type}'::shop_type,
      '${shop.shop_status}'::shop_status,
      '${shop.verification_status}'::shop_verification_status,
      ${shop.commission_rate}::numeric,
      ${shop.total_bookings}::integer,
      ${shop.is_featured}::boolean,
      '${shop.created_at}'::timestamptz,
      '${shop.updated_at}'::timestamptz
    )`;
  }).join(',\n    ');

  const sql = `
INSERT INTO shops (
  id,
  name,
  address,
  phone_number,
  latitude,
  longitude,
  location,
  main_category,
  sub_categories,
  shop_type,
  shop_status,
  verification_status,
  commission_rate,
  total_bookings,
  is_featured,
  created_at,
  updated_at
)
VALUES
    ${values}
ON CONFLICT (id) DO NOTHING;
`;

  return sql;
}

function main() {
  const batchSize = 50; // Insert 50 shops at a time
  const filename = 'shops_for_supabase.json';
  const filePath = path.join(__dirname, filename);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Batch Shop Insertion`);
  console.log(`${'='.repeat(60)}\n`);

  // Read shop data
  const shops: ShopData[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`📂 Total shops to insert: ${shops.length}`);
  console.log(`📦 Batch size: ${batchSize} shops per batch`);
  console.log(`📊 Total batches: ${Math.ceil(shops.length / batchSize)}`);
  console.log(``);

  // Create batches directory
  const batchesDir = path.join(__dirname, 'batches');
  if (!fs.existsSync(batchesDir)) {
    fs.mkdirSync(batchesDir);
  }

  // Split into batches
  const batches: ShopData[][] = [];
  for (let i = 0; i < shops.length; i += batchSize) {
    batches.push(shops.slice(i, i + batchSize));
  }

  console.log(`📝 Generating SQL files for ${batches.length} batches...\n`);

  batches.forEach((batch, index) => {
    const batchNum = index + 1;
    const sql = generateInsertSQL(batch);
    const sqlFilename = `batch_${String(batchNum).padStart(2, '0')}.sql`;
    const sqlPath = path.join(batchesDir, sqlFilename);

    fs.writeFileSync(sqlPath, sql, 'utf-8');

    const categoryCount: Record<string, number> = {};
    batch.forEach(shop => {
      categoryCount[shop.main_category] = (categoryCount[shop.main_category] || 0) + 1;
    });

    console.log(`✅ Batch ${batchNum}/${batches.length}: ${batch.length} shops → ${sqlFilename}`);
    console.log(`   Categories: ${Object.entries(categoryCount).map(([cat, count]) => `${cat}(${count})`).join(', ')}`);
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✨ All SQL files generated in: ./batches/`);
  console.log(`${'='.repeat(60)}\n`);

  // Create a master script
  const masterScript = batches.map((_, index) => {
    const batchNum = index + 1;
    const filename = `batch_${String(batchNum).padStart(2, '0')}.sql`;
    return `-- Batch ${batchNum}/${batches.length}\ncat batches/${filename} | supabase db execute`;
  }).join('\n\n');

  fs.writeFileSync(
    path.join(__dirname, 'insert_all_batches.sh'),
    '#!/bin/bash\n# Execute all batches\n\n' + masterScript,
    'utf-8'
  );

  console.log(`📜 Instructions for manual insertion:\n`);
  console.log(`   For each batch file in ./batches/:`);
  console.log(`   1. Read the SQL content`);
  console.log(`   2. Execute via: mcp__supabase__execute_sql`);
  console.log(`   3. Verify insertion success`);
  console.log(``);
}

if (require.main === module) {
  main();
}
