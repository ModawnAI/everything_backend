# 🏪 Shop Data Import Guide with Kakao Maps Integration

## 📋 Overview

This guide provides a comprehensive solution for importing Korean shop data into your Supabase database with accurate geocoding using Kakao Maps API and map visualization capabilities.

---

## 🗂️ Data Structure

### **Input CSV Format**
Your CSV file should have the following columns (Korean government data format):

| Column | Korean Name | Description | Example |
|--------|-------------|-------------|---------|
| 사업장명 | Business Name | Shop name | 더예쁜머리 |
| 지번주소 | Lot Address | Old address system | 서울특별시 종로구 효제동 320-6번지 |
| 전화번호 | Phone Number | Contact number | 02-743-9700 |
| 업태구분명 | Business Type | Business classification | 기타 |
| 위생업태명 | Hygiene Business | Specific service type | 일반미용업, 네일미용업 |
| 좌석수 | Seat Count | Number of seats | 7 |
| 도로명주소 | Road Address | New address system | 서울특별시 종로구 종로33길 12, 2층 2호 |
| 소재지우편번호 | Postal Code | ZIP code | 110-480 |
| 인허가일자 | License Date | Business license date | 2016-05-11 |

### **Output Database Schema**
The data will be mapped to your Supabase `shops` table:

```sql
CREATE TABLE public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    phone_number VARCHAR(20),
    address TEXT NOT NULL,
    detailed_address TEXT,
    postal_code VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326), -- PostGIS for spatial queries
    main_category service_category NOT NULL,
    sub_categories service_category[],
    operating_hours JSONB,
    payment_methods payment_method[],
    shop_status shop_status DEFAULT 'pending_approval',
    import_metadata JSONB
);
```

---

## 🔧 Setup & Configuration

### **1. Environment Variables**
Create or update your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://ysrudwzwnzxrrwjtpuoh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Kakao Maps API Configuration
KAKAO_MAPS_API_KEY=your_kakao_api_key

# Frontend Configuration (for map display)
NEXT_PUBLIC_KAKAO_MAPS_API_KEY=your_kakao_api_key
NEXT_PUBLIC_SUPABASE_URL=https://ysrudwzwnzxrrwjtpuoh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### **2. Install Dependencies**
```bash
# Backend dependencies
npm install csv-parser @supabase/supabase-js dotenv

# Frontend dependencies (for map visualization)
npm install @types/kakao
```

### **3. Get Kakao Maps API Credentials**
1. **Sign up** for [Kakao Developers](https://developers.kakao.com/)
2. **Create application** and register your platform
3. **Activate Kakao Map API** in app settings
4. **Get your JavaScript API key** for web integration

---

## 🚀 Usage Instructions

### **Step 1: Prepare Your CSV Data**
Ensure your CSV file follows the Korean government format:

```csv
사업장명,지번주소,전화번호,업태구분명,위생업태명,좌석수,도로명주소,소재지우편번호,인허가일자
더예쁜머리,서울특별시 종로구 효제동 320-6번지,02-743-9700,기타,일반미용업, 네일미용업,7,서울특별시 종로구 종로33길 12 2층 2호 (효제동),110-480,2016-05-11
```

### **Step 2: Geocode Addresses (Recommended)**
First, geocode all addresses to get accurate coordinates:

```bash
# Geocode addresses and save to JSON
node scripts/enhanced-shop-import.js your-shop-data.csv \
  --geocode \
  --output=geocoded-shops.json \
  --map-data=map-visualization.json
```

**Expected Output:**
```
🚀 Starting enhanced shop data processing...
📁 Input file: your-shop-data.csv
🗺️  Geocoding enabled - this may take a while...
⏱️  Estimated time: 2 minutes

🔄 Processing 1/100 (1.0%): 더예쁜머리
✅ Geocoded: 37.570841, 126.985302

📊 Found 100 records in CSV
✅ Successfully converted 98 shops
🗺️  Map visualization data saved to: map-visualization.json
📍 Map Statistics:
   📊 Total shops: 100
   📍 Geocoded: 98
   📈 Success rate: 98.0%
```

### **Step 3: Preview Import (Dry Run)**
Test the import without actually inserting data:

```bash
node scripts/enhanced-shop-import.js geocoded-shops.json \
  --import \
  --dry-run \
  --batch-size=10
```

### **Step 4: Import to Supabase**
Import the geocoded data to your database:

```bash
node scripts/enhanced-shop-import.js geocoded-shops.json \
  --import \
  --batch-size=10
```

**Expected Output:**
```
🏪 Importing 98 shops to Supabase...
📦 Processing batch 1/10 (10 shops)
✅ Batch 1 imported successfully (10 shops)

📊 Import Summary:
✅ Successful: 95
❌ Failed: 3
📈 Success Rate: 97.0%
```

---

## 🗺️ Map Visualization

### **1. Frontend Integration**
Add the map component to your React/Next.js frontend:

```tsx
// pages/admin/shops/map.tsx
import { AdminShopMapDashboard } from '@/components/ShopMap'

export default function ShopMapPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Shop Location Dashboard</h1>
      <AdminShopMapDashboard />
    </div>
  )
}
```

### **2. Service API Integration**
Update your shop search API to include coordinates:

```typescript
// In your shop service
async searchShops(params: {
  includeCoordinates?: boolean;
  category?: string;
  location?: string;
  radius?: number;
}) {
  let query = this.supabase
    .from('shops')
    .select(`
      id, name, address, phone_number, main_category, sub_categories,
      latitude, longitude, shop_status, verification_status,
      operating_hours, is_featured, total_bookings
    `);

  // Add spatial search if location and radius provided
  if (params.location && params.radius && params.includeCoordinates) {
    // Use PostGIS for spatial search
    query = query.rpc('shops_within_radius', {
      center_lat: params.location.split(',')[0],
      center_lng: params.location.split(',')[1], 
      radius_km: params.radius
    });
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  return data;
}
```

### **3. Map Component Usage**
```tsx
// Customer-facing shop map
import { ShopMapContainer } from '@/components/ShopMap'

export function ShopDiscoveryPage() {
  const [selectedShop, setSelectedShop] = useState(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ShopMapContainer 
          searchParams={{
            category: 'nail',
            radius: 5
          }}
          onShopSelect={setSelectedShop}
          height="600px"
        />
      </div>
      
      <div>
        {selectedShop && (
          <ShopDetailsCard shop={selectedShop} />
        )}
      </div>
    </div>
  )
}
```

---

## 📊 Data Quality & Validation

### **1. Geocoding Accuracy Levels**
The import script provides accuracy indicators:

- **`high`**: Exact address match with Kakao Maps
- **`medium`**: Approximate location (street level)
- **`low`**: General area match
- **`failed`**: No coordinates found
- **`none`**: Geocoding not attempted

### **2. Data Validation Rules**
```typescript
// Validation checks performed during import
const validationRules = {
  required: ['name', 'address', 'main_category'],
  
  formats: {
    phone_number: /^\+82-\d{1,2}-\d{3,4}-\d{4}$/,
    postal_code: /^\d{5,6}$/,
    coordinates: {
      latitude: { min: 33.0, max: 38.6 },   // South Korea bounds
      longitude: { min: 124.5, max: 131.9 }
    }
  },
  
  enums: {
    main_category: ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'],
    shop_status: ['active', 'inactive', 'pending_approval', 'suspended', 'deleted']
  }
}
```

### **3. Business Type Mapping**
The script automatically maps Korean business types to your service categories:

```javascript
const mappings = {
  '일반미용업' → 'hair',
  '네일미용업' → 'nail', 
  '속눈썹연장업' → 'eyelash',
  '왁싱업' → 'waxing',
  '반영구화장업' → 'eyebrow_tattoo'
}
```

---

## 🔍 Troubleshooting

### **Common Issues & Solutions**

#### **1. Geocoding Failures**
```bash
# Issue: High geocoding failure rate
# Solution: Check address format and API credentials

# Debug geocoding for specific address
node -e "
const { geocodeAddressWithKakao } = require('./scripts/enhanced-shop-import.js');
geocodeAddressWithKakao('서울특별시 강남구 테헤란로 123').then(console.log);
"
```

#### **2. API Rate Limiting**
```bash
# Issue: Too many requests error
# Solution: Increase delay between requests

node scripts/enhanced-shop-import.js shop-data.csv \
  --geocode \
  --output=shops.json \
  --batch-size=10  # Smaller batches
```

#### **3. Invalid Coordinates**
```sql
-- Check for shops with invalid coordinates
SELECT name, latitude, longitude, address 
FROM shops 
WHERE latitude IS NOT NULL 
  AND (latitude < 33.0 OR latitude > 38.6 OR longitude < 124.5 OR longitude > 131.9);
```

#### **4. Missing Categories**
```sql
-- Find shops with unmapped categories
SELECT DISTINCT import_metadata->>'original_hygiene_business' as original_type, main_category
FROM shops 
WHERE import_metadata->>'original_hygiene_business' IS NOT NULL
ORDER BY original_type;
```

---

## 📈 Performance Optimization

### **1. Spatial Indexing**
Ensure your database has proper spatial indexes:

```sql
-- Create spatial index for location-based queries
CREATE INDEX IF NOT EXISTS shops_location_gist_idx 
ON shops USING GIST (location);

-- Create index for category searches
CREATE INDEX IF NOT EXISTS shops_category_idx 
ON shops (main_category, shop_status);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS shops_search_idx 
ON shops (shop_status, main_category, is_featured);
```

### **2. Frontend Optimization**
```typescript
// Optimize map rendering with clustering
const mapOptions = {
  // Cluster markers when zoomed out
  cluster: {
    enabled: true,
    maxZoom: 13,
    radius: 50
  },
  
  // Lazy load marker details
  lazyLoadMarkers: true,
  
  // Optimize for mobile
  gestureHandling: 'cooperative',
  
  // Reduce API calls
  debounceMs: 300
}
```

---

## 🧪 Testing & Validation

### **1. Test Import Script**
```bash
# Test with sample data
node scripts/enhanced-shop-import.js sample-shop-data.csv \
  --geocode \
  --output=test-output.json \
  --map-data=test-map.json \
  --dry-run

# Verify output format
node -e "
const data = require('./test-output.json');
console.log('Sample shop:', JSON.stringify(data[0], null, 2));
"
```

### **2. Validate Database Integration**
```sql
-- Test spatial queries work correctly
SELECT name, address, 
       ST_X(location::geometry) as longitude,
       ST_Y(location::geometry) as latitude
FROM shops 
WHERE location IS NOT NULL 
LIMIT 5;

-- Test category distribution
SELECT main_category, COUNT(*) as count
FROM shops 
GROUP BY main_category 
ORDER BY count DESC;
```

### **3. Test Map Visualization**
```tsx
// Test map component with sample data
import { ShopMap } from '@/components/ShopMap'

const sampleShops = [
  {
    id: '1',
    name: '더예쁜머리',
    address: '서울특별시 종로구 종로33길 12',
    latitude: 37.570841,
    longitude: 126.985302,
    mainCategory: 'hair',
    phoneNumber: '+82-2-743-9700'
  }
]

export function TestMapPage() {
  return (
    <ShopMap 
      shops={sampleShops}
      onShopSelect={(shop) => console.log('Selected:', shop)}
      height="500px"
    />
  )
}
```

---

## 📊 Expected Results

### **1. Import Statistics**
After running the import script, you should see:

```
📊 Import Summary:
✅ Successful: 950/1000 shops
❌ Failed: 50/1000 shops  
📈 Success Rate: 95.0%

🗺️ Geocoding Results:
📍 High accuracy: 850 shops
📍 Medium accuracy: 100 shops
❌ Failed geocoding: 50 shops
📈 Geocoding success rate: 95.0%

🏪 Category Distribution:
💇 hair: 450 shops
💅 nail: 300 shops  
👁️ eyelash: 150 shops
✨ waxing: 50 shops
```

### **2. Database Verification**
```sql
-- Verify import results
SELECT 
  COUNT(*) as total_shops,
  COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as geocoded_shops,
  COUNT(CASE WHEN shop_status = 'pending_approval' THEN 1 END) as pending_approval
FROM shops;

-- Check coordinate distribution
SELECT 
  main_category,
  COUNT(*) as total,
  COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as with_coordinates,
  ROUND(
    COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*) * 100, 1
  ) as geocoding_rate
FROM shops 
GROUP BY main_category
ORDER BY total DESC;
```

### **3. Map Visualization**
The generated map data will include:

```json
{
  "center": { "lat": 37.5665, "lng": 126.9780 },
  "zoom": 11,
  "bounds": {
    "north": 37.7,
    "south": 37.4,
    "east": 127.2,
    "west": 126.7
  },
  "markers": [
    {
      "id": "shop-0",
      "position": { "lat": 37.570841, "lng": 126.985302 },
      "title": "더예쁜머리",
      "category": "hair",
      "accuracy": "high"
    }
  ],
  "statistics": {
    "total": 1000,
    "geocoded": 950,
    "categories": {
      "hair": 450,
      "nail": 300,
      "eyelash": 150
    },
    "geocodingSuccessRate": "95.0"
  }
}
```

---

## 🔄 Workflow Examples

### **Complete Import Workflow**
```bash
#!/bin/bash
# complete-shop-import.sh

echo "🚀 Starting complete shop import workflow..."

# Step 1: Geocode addresses
echo "📍 Step 1: Geocoding addresses..."
node scripts/enhanced-shop-import.js raw-shop-data.csv \
  --geocode \
  --output=geocoded-shops.json \
  --map-data=shop-map-data.json

# Step 2: Validate data
echo "✅ Step 2: Validating converted data..."
node scripts/enhanced-shop-import.js geocoded-shops.json \
  --import \
  --dry-run

# Step 3: Import to database
echo "💾 Step 3: Importing to Supabase..."
node scripts/enhanced-shop-import.js geocoded-shops.json \
  --import \
  --batch-size=20

# Step 4: Verify import
echo "🔍 Step 4: Verifying import..."
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

supabase.from('shops').select('count').then(({ data, error }) => {
  if (error) console.error('❌ Verification failed:', error);
  else console.log('✅ Total shops in database:', data[0].count);
});
"

echo "🎉 Import workflow complete!"
```

### **Update Existing Coordinates**
```bash
# If you need to re-geocode existing shops
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function updateCoordinates() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Get shops without coordinates
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, address')
    .is('latitude', null);
    
  console.log(\`Found \${shops.length} shops without coordinates\`);
  
  // Process each shop
  for (const shop of shops) {
    const result = await geocodeAddressWithKakao(shop.address);
    
    if (result.success) {
      await supabase
        .from('shops')
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          location: \`POINT(\${result.longitude} \${result.latitude})\`
        })
        .eq('id', shop.id);
        
      console.log(\`✅ Updated coordinates for: \${shop.name}\`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

updateCoordinates().catch(console.error);
"
```

---

## 🎯 Integration with Service APIs

### **1. Enhanced Shop Search API**
Your existing shop search API can now leverage the coordinate data:

```typescript
// GET /api/shops/search with location support
async searchShops(req: Request, res: Response) {
  const { 
    category, 
    latitude, 
    longitude, 
    radius = 5, // Default 5km radius
    includeDistance = false 
  } = req.query;

  let query = supabase
    .from('shops')
    .select('*');

  // Add spatial search if coordinates provided
  if (latitude && longitude) {
    query = query.rpc('shops_within_radius', {
      center_lat: parseFloat(latitude),
      center_lng: parseFloat(longitude),
      radius_km: parseFloat(radius)
    });
  }

  // Add category filter
  if (category) {
    query = query.eq('main_category', category);
  }

  const { data: shops, error } = await query;
  
  if (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to search shops' 
    });
  }

  res.json({
    success: true,
    data: {
      shops: shops.map(shop => ({
        ...shop,
        distance: shop.distance_km ? `${shop.distance_km.toFixed(1)}km` : null
      })),
      searchCriteria: { category, latitude, longitude, radius }
    }
  });
}
```

### **2. PostGIS Spatial Functions**
Add these functions to your database for spatial queries:

```sql
-- Function to find shops within radius
CREATE OR REPLACE FUNCTION shops_within_radius(
  center_lat DECIMAL,
  center_lng DECIMAL, 
  radius_km DECIMAL
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  address TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  main_category service_category,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.address,
    s.latitude,
    s.longitude,
    s.main_category,
    ROUND(
      ST_Distance(
        s.location,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
      ) / 1000, 2
    ) as distance_km
  FROM shops s
  WHERE s.location IS NOT NULL
    AND ST_DWithin(
      s.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_km * 1000
    )
    AND s.shop_status = 'active'
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
```

---

## 🚀 Next Steps

### **1. After Import**
1. **Review imported data** in admin dashboard
2. **Approve shops** that look legitimate  
3. **Add missing information** (descriptions, images, etc.)
4. **Test map functionality** on frontend
5. **Configure spatial search** parameters

### **2. Ongoing Maintenance**
1. **Regular geocoding updates** for new addresses
2. **Data quality monitoring** with automated checks
3. **Performance optimization** based on usage patterns
4. **User feedback integration** for location accuracy

### **3. Advanced Features**
1. **Clustering algorithms** for dense areas
2. **Route optimization** for service areas
3. **Heatmap visualization** for popular areas
4. **Real-time location updates** via admin panel

This comprehensive solution provides everything needed to import, geocode, and visualize Korean shop data with professional-grade accuracy and performance!
