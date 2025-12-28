# Real Shop Data Insertion Guide

## Summary

Successfully prepared **243 real Korean beauty shops** for insertion into Supabase database.

## Completed Steps ✅

1. ✅ **Geocoding**: Used Kakao Maps API to geocode 243/246 shop addresses
2. ✅ **Data Transformation**: Mapped Korean shop types to ServiceCategory enums
3. ✅ **SQL Generation**: Created 5 batch SQL files (50 shops each)
4. ✅ **Test Insertion**: Successfully inserted 10 test shops via Supabase MCP

## Data Quality

### Geocoding Results
- **Total addresses**: 246
- **Successfully geocoded**: 243 (98.8%)
- **Failed**: 3 shops (no coordinates)
- **Coordinate validation**: All within Seoul bounds (37.4-37.7°N, 126.8-127.2°E)

### Category Distribution
```
hair (일반미용업, 종합미용업)       : 169 shops (69.5%)
waxing (피부미용업)               :  59 shops (24.3%)
nail (네일미용업)                 :  11 shops (4.5%)
eyebrow_tattoo (화장ㆍ분장 미용업)  :   4 shops (1.6%)
```

### Shop Status
- **shop_type**: `non_partnered` (all 243 shops)
- **shop_status**: `pending_approval` (requires manual approval)
- **verification_status**: `pending`
- **commission_rate**: 0.15 (15%)

## File Structure

```
kakao/
├── shop.csv                        # Original shop data (246 rows)
├── shop_with_coordinates.csv       # Geocoded data (243 valid)
├── shops_for_supabase.json        # Transformed data (243 shops)
├── shops_test_batch.json          # Test batch (10 shops)
├── batches/                       # SQL batch files
│   ├── batch_01.sql              # 50 shops (nail: 11, hair: 39)
│   ├── batch_02.sql              # 50 shops (hair: 50)
│   ├── batch_03.sql              # 50 shops (hair: 50)
│   ├── batch_04.sql              # 50 shops (hair: 30, waxing: 20)
│   └── batch_05.sql              # 43 shops (waxing: 39, eyebrow_tattoo: 4)
├── geocode_korean_addresses.py    # Geocoding script
├── transform_shops_for_supabase.py # Data transformation script
├── insert_shops.ts                # SQL generation script
└── insert_in_batches.ts           # Batch generator script
```

## Batch Insertion Instructions

### Method 1: Using Supabase MCP (Recommended)

Execute each batch using `mcp__supabase__execute_sql`:

```typescript
// Batch 1 (50 shops - nail & hair)
const batch1 = fs.readFileSync('kakao/batches/batch_01.sql', 'utf-8');
await mcp__supabase__execute_sql({ query: batch1 });

// Batch 2 (50 shops - hair only)
const batch2 = fs.readFileSync('kakao/batches/batch_02.sql', 'utf-8');
await mcp__supabase__execute_sql({ query: batch2 });

// ... repeat for batches 3, 4, 5
```

### Method 2: Using Supabase CLI

```bash
cd kakao
for i in 01 02 03 04 05; do
  echo "Executing batch $i..."
  supabase db execute < batches/batch_$i.sql
done
```

### Method 3: Manual Execution

1. Copy SQL content from each batch file
2. Execute in Supabase SQL Editor
3. Verify insertion count after each batch

## Verification Queries

### Check Total Shop Count
```sql
SELECT COUNT(*) as total_shops
FROM shops
WHERE shop_type = 'non_partnered';
```

Expected: **~243 shops** (excluding existing seed data)

### Verify Category Distribution
```sql
SELECT
  main_category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM shops
WHERE shop_type = 'non_partnered'
GROUP BY main_category
ORDER BY count DESC;
```

Expected:
```
main_category    | count | percentage
-----------------|-------|------------
hair             | 169   | 69.5%
waxing           |  59   | 24.3%
nail             |  11   |  4.5%
eyebrow_tattoo   |   4   |  1.6%
```

### Verify Geocoding
```sql
SELECT
  COUNT(*) as total,
  COUNT(latitude) as with_coords,
  COUNT(*) - COUNT(latitude) as missing_coords
FROM shops
WHERE shop_type = 'non_partnered';
```

Expected: All shops should have coordinates

### Check Seoul Bounds
```sql
SELECT
  COUNT(*) as shops_in_seoul
FROM shops
WHERE shop_type = 'non_partnered'
  AND latitude BETWEEN 37.4 AND 37.7
  AND longitude BETWEEN 126.8 AND 127.2;
```

Expected: All shops within Seoul bounds

### Sample Data Preview
```sql
SELECT
  name,
  main_category,
  sub_categories,
  address,
  ROUND(latitude::numeric, 4) as lat,
  ROUND(longitude::numeric, 4) as lon,
  shop_status
FROM shops
WHERE shop_type = 'non_partnered'
ORDER BY created_at DESC
LIMIT 10;
```

## Spatial Query Test

Test PostGIS functionality with nearby shops:

```sql
-- Find shops within 1km of Gangnam Station (37.4979, 127.0276)
SELECT
  name,
  main_category,
  address,
  ROUND(
    ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint(127.0276, 37.4979), 4326)::geography
    )::numeric / 1000,
    2
  ) as distance_km
FROM shops
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(127.0276, 37.4979), 4326)::geography,
  1000  -- 1000 meters = 1km
)
AND shop_type = 'non_partnered'
ORDER BY location <-> ST_SetSRID(ST_MakePoint(127.0276, 37.4979), 4326)::geography
LIMIT 10;
```

## Failed Shops (No Coordinates)

These 3 shops were skipped due to geocoding failure:

1. **살롱 드 라움, 부티끄** - Could not geocode address
2. **송해영 헤어뉴스** - Could not geocode address
3. **비긴바이오네일(Begin Bio Nail)** - Could not geocode address

These can be manually geocoded and added later if needed.

## Next Steps

1. **Execute all 5 batches** using one of the methods above
2. **Verify insertion** using the queries provided
3. **Test spatial queries** to ensure PostGIS integration works
4. **Update shop_status** to 'active' after manual review (if needed)
5. **Consider adding shop images** from shop_images table
6. **Link shop services** from shop_services table

## Rollback (If Needed)

To remove all inserted shops:

```sql
DELETE FROM shops
WHERE shop_type = 'non_partnered'
  AND shop_status = 'pending_approval'
  AND created_at >= '2025-11-10T00:00:00Z';
```

## Notes

- All shops are set to `shop_status: 'pending_approval'` to allow manual review before activation
- Phone numbers are cleaned but retain Korean format (e.g., "02 544 8088")
- Sub-categories are populated for mixed-type shops (e.g., nail + eyebrow tattoo)
- Coordinates use WGS84 (SRID 4326) for global compatibility
- PostGIS geography type enables accurate distance calculations

---

**Generated**: 2025-11-10
**Total Shops**: 243
**Success Rate**: 98.8%
