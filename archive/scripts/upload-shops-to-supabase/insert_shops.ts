#!/usr/bin/env ts-node
/**
 * Insert real shop data into Supabase database
 * Usage: npx ts-node insert_shops.ts [test|all]
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
  const mode = process.argv[2] || 'test';

  const filename = mode === 'test'
    ? 'shops_test_batch.json'
    : 'shops_for_supabase.json';

  const filePath = path.join(__dirname, filename);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Shop Insertion Script (Mode: ${mode.toUpperCase()})`);
  console.log(`${'='.repeat(60)}\n`);

  // Read shop data
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filename}`);
    console.error(`   Please run transform_shops_for_supabase.py first`);
    process.exit(1);
  }

  const shops: ShopData[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`📂 Loaded ${shops.length} shops from ${filename}`);
  console.log(`\n📊 Category Breakdown:`);

  // Show category distribution
  const categoryCount: Record<string, number> = {};
  shops.forEach(shop => {
    categoryCount[shop.main_category] = (categoryCount[shop.main_category] || 0) + 1;
  });

  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category.padEnd(20)} : ${count} shops`);
    });

  // Generate SQL
  const sql = generateInsertSQL(shops);

  // Save SQL to file
  const sqlFilename = mode === 'test' ? 'insert_shops_test.sql' : 'insert_shops_all.sql';
  const sqlPath = path.join(__dirname, sqlFilename);
  fs.writeFileSync(sqlPath, sql, 'utf-8');

  console.log(`\n✅ SQL file generated: ${sqlFilename}`);
  console.log(`   File size: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Next Steps:`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`1. Review the generated SQL file: ${sqlFilename}`);
  console.log(`2. Use Supabase MCP to execute the SQL:`);
  console.log(`   • For test batch (10 shops):`);
  console.log(`     mcp__supabase__execute_sql with insert_shops_test.sql`);
  console.log(`   • For all shops (${shops.length} shops):`);
  console.log(`     mcp__supabase__execute_sql with insert_shops_all.sql`);
  console.log(`\n${'='.repeat(60)}\n`);

  // Preview first 3 shops
  console.log(`📝 Preview of shops to be inserted:\n`);
  shops.slice(0, 3).forEach((shop, idx) => {
    console.log(`${idx + 1}. ${shop.name}`);
    console.log(`   Category: ${shop.main_category}${shop.sub_categories ? ` (+ ${shop.sub_categories.join(', ')})` : ''}`);
    console.log(`   Location: ${shop.address}`);
    console.log(`   Coords: (${shop.latitude.toFixed(4)}, ${shop.longitude.toFixed(4)})`);
    console.log(``);
  });

  return sql;
}

if (require.main === module) {
  main();
}
