# 🗺️ Kakao Maps API Setup Guide

## 🚨 Current Issue

Both API keys are showing the same error:
```json
{
  "errorType": "NotAuthorizedError", 
  "message": "App(Qmask) disabled OPEN_MAP_AND_LOCAL service."
}
```

This means the **Kakao Map service is disabled** in your Kakao Developer console.

---

## 🔧 Solution 1: Enable Kakao Map Service (Recommended)

### **Step 1: Access Kakao Developers Console**
1. Go to [Kakao Developers](https://developers.kakao.com/)
2. Log in with your Kakao account
3. Click **"내 애플리케이션"** (My Applications)

### **Step 2: Select Your App**
- Choose **"Qmask"** (or the app associated with key `d4e5325de20cd18e48e3fe8e572c0d59`)

### **Step 3: Enable Map Service**
1. In the left sidebar, click **"제품 설정"** (Product Settings)
2. Find **"카카오맵"** (Kakao Map) section
3. **Click the toggle switch** to turn it **ON**
4. Verify the **"상태"** (Status) shows **"사용함"** (Enabled)

### **Step 4: Configure Platform Settings**
1. Click **"플랫폼"** (Platform) in the left sidebar
2. Add your platform:
   - **Web**: Add `http://localhost:3000` for development
   - **Web**: Add your production domain when ready
3. Save the settings

### **Step 5: Wait for Activation**
- Service activation can take **5-10 minutes**
- Check the status periodically

### **Step 6: Test the API**
```bash
# Test after enabling the service
curl -G "https://dapi.kakao.com/v2/local/search/address.json" \
  -H "Authorization: KakaoAK d4e5325de20cd18e48e3fe8e572c0d59" \
  --data-urlencode "query=서울역"
```

---

## 🔧 Solution 2: Alternative Geocoding Services

If Kakao Maps continues to have issues, here are alternatives:

### **Option A: Google Maps Geocoding API**
```javascript
// Google Maps Geocoding API
const response = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`
);
```

**Pros**: Very reliable, excellent for Korean addresses
**Cons**: Requires billing account, costs money after free tier

### **Option B: OpenStreetMap Nominatim (Free)**
```javascript
// Nominatim (Free)
const response = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
);
```

**Pros**: Completely free, no API key required
**Cons**: Lower accuracy for Korean addresses

### **Option C: Vworld API (Korean Government)**
```javascript
// Vworld API (Korean Government)
const response = await fetch(
  `https://api.vworld.kr/req/address?service=address&request=getcoord&address=${encodeURIComponent(address)}&format=json&type=road&key=${vworldKey}`
);
```

**Pros**: Free, optimized for Korean addresses
**Cons**: Requires separate registration

---

## 🧪 Test Script

Here's a script to test multiple geocoding services:

```javascript
// test-multiple-geocoding.js
const testServices = {
  kakao: async (address) => {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      {
        headers: {
          'Authorization': 'KakaoAK d4e5325de20cd18e48e3fe8e572c0d59'
        }
      }
    );
    const data = await response.json();
    
    if (response.ok && data.documents?.length > 0) {
      const doc = data.documents[0];
      return {
        success: true,
        latitude: parseFloat(doc.y),
        longitude: parseFloat(doc.x),
        address: doc.address_name,
        service: 'Kakao Maps'
      };
    }
    
    return { success: false, error: data.message, service: 'Kakao Maps' };
  },
  
  nominatim: async (address) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=kr`
    );
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        success: true,
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        address: data[0].display_name,
        service: 'Nominatim (OSM)'
      };
    }
    
    return { success: false, error: 'No results', service: 'Nominatim (OSM)' };
  }
};

async function testAllServices(address) {
  console.log(`🔍 Testing geocoding for: ${address}\n`);
  
  for (const [name, service] of Object.entries(testServices)) {
    try {
      const result = await service(address);
      
      if (result.success) {
        console.log(`✅ ${result.service}: ${result.latitude}, ${result.longitude}`);
      } else {
        console.log(`❌ ${result.service}: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test with your address
testAllServices('서울특별시 동대문구 청량리동 235-4번지');
```

---

## 📋 Immediate Next Steps

1. **Enable Kakao Map Service** in your developer console (5-10 minutes)
2. **Test the API** with our check script
3. **If still issues**, we can implement a fallback system with multiple geocoding services
4. **Update your import scripts** once geocoding is working

---

## 🎯 Expected Success Response

Once the service is enabled, you should see:

```json
{
  "documents": [
    {
      "address_name": "서울 동대문구 청량리동 235-4",
      "y": "37.5821297708223",
      "x": "127.047103819399",
      "address_type": "REGION_ADDR",
      "address": {
        "address_name": "서울 동대문구 청량리동 235-4",
        "region_1depth_name": "서울",
        "region_2depth_name": "동대문구",
        "region_3depth_name": "청량리동",
        // ... more details
      },
      "road_address": {
        "address_name": "서울 동대문구 왕산로 225",
        "building_name": "미주상가",
        // ... more details
      }
    }
  ],
  "meta": {
    "total_count": 1,
    "pageable_count": 1,
    "is_end": true
  }
}
```

Let me know once you've enabled the Kakao Map service, and we can test it immediately! 🚀
