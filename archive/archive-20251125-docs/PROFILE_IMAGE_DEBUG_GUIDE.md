# Profile Image Upload Debug Guide

## Problem Summary
Profile images are not being saved and `profileImageUrl` returns `undefined`.

## Backend Architecture

### Image Upload Flow
```
Frontend → POST /api/users/profile/image (with image file)
  ↓
  Upload image to Supabase Storage
  ↓
  Update users.profile_image_url in database
  ↓
  Return imageUrl, thumbnailUrl, metadata
```

### Profile Update Flow
```
Frontend → PUT /api/users/profile (with profileImageUrl)
  ↓
  Transform profileImageUrl → profile_image_url
  ↓
  Update users table
  ↓
  Return updated user profile
```

## Backend Implementation Status

### ✅ Confirmed Working

1. **Upload Endpoint** (`/api/users/profile/image`)
   - Location: `src/routes/user-profile.routes.ts:320`
   - Accepts multipart/form-data with field name `image`
   - Also has alias: `/api/users/profile/avatar` with field name `avatar` (line 352)
   - Max file size: 5MB
   - Allowed types: JPEG, PNG, WebP

2. **Image Processing** (`user-profile.service.ts:825-875`)
   - Validates image file (5MB max, allowed extensions)
   - Uses Sharp.js to optimize:
     - Main image: 800x800px, WebP format, 85% quality
     - Thumbnail: 150x150px, WebP format, 80% quality
   - Uploads to Supabase Storage bucket: `profile-images`
   - Returns public URLs

3. **Database Update** (`user-profile.service.ts:846`)
   - **CRITICAL**: After upload, automatically calls:
     ```typescript
     await this.updateUserProfile(userId, { profile_image_url: mainImageUrl });
     ```
   - This updates the `users.profile_image_url` column immediately

4. **Profile Update Endpoint** (`/api/users/profile`)
   - Location: `src/controllers/user-profile.controller.ts:94-173`
   - Transforms camelCase to snake_case:
     - `profileImageUrl` → `profile_image_url`
     - `birthDate` → `birth_date`
     - `bookingPreferences` → `booking_preferences`

5. **Database Schema**
   ```sql
   users table columns:
   - profile_image_url (text, nullable) ✅
   - booking_preferences (jsonb, nullable) ✅
   ```

## Issue Diagnosis

### Frontend Logs Show:
```javascript
[ProfilePage] Final profileImageUrl: undefined
[ProfilePage] Updating profile with: {bookingPreferences: {...}, profileImageUrl: undefined}
[ProfilePage] Profile update response: {profileImageUrl: undefined, ...}
[ProfilePage] Supabase avatar_url: undefined
[ProfilePage] Supabase picture: undefined
```

### Root Cause: Frontend Issue
The backend is correctly implemented. The problem is on the **frontend**:

1. **Image Upload Not Happening**: The frontend is sending `profileImageUrl: undefined`, which means:
   - Either the image upload endpoint was never called, OR
   - The upload failed and the frontend didn't handle the error, OR
   - The frontend received the imageUrl but lost it before updating the profile

## Frontend Debugging Steps

### Step 1: Verify Upload Endpoint Call
Check the frontend code for the image upload:

```typescript
// Should be calling:
const formData = new FormData();
formData.append('image', imageFile); // NOT 'avatar' - use 'image'

const response = await fetch('https://api.e-beautything.com/api/users/profile/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await response.json();
// result.data.imageUrl should contain the URL
```

**Common Mistakes**:
- ❌ Using field name `avatar` instead of `image`
- ❌ Sending to `/api/profile/image` instead of `/api/users/profile/image`
- ❌ Not including Authorization header
- ❌ Not waiting for upload to complete before updating profile

### Step 2: Expected API Response
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/profile-images/profile-{userId}-{timestamp}.webp",
    "thumbnailUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/profile-images/thumbnails/profile-{userId}-{timestamp}.webp",
    "metadata": {
      "originalSize": 123456,
      "optimizedSize": 45678,
      "width": 800,
      "height": 800,
      "format": "webp"
    }
  },
  "message": "프로필 이미지가 업로드되었습니다."
}
```

### Step 3: Verify Profile Update Flow
After successful image upload:

```typescript
// 1. Upload image first
const uploadResponse = await uploadImage(file);
const imageUrl = uploadResponse.data.imageUrl;

// 2. THEN update profile with the URL
const profileResponse = await updateProfile({
  profileImageUrl: imageUrl, // ← Should NOT be undefined
  bookingPreferences: {...}
});
```

## Backend Testing

### Test Image Upload Directly
```bash
# Test 1: Upload image (replace with actual auth token)
curl -X POST https://api.e-beautything.com/api/users/profile/image \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@/path/to/test-image.jpg"

# Expected response:
{
  "success": true,
  "data": {
    "imageUrl": "https://...",
    "thumbnailUrl": "https://...",
    "metadata": {...}
  }
}
```

### Test Profile Update with Image URL
```bash
# Test 2: Update profile with image URL
curl -X PUT https://api.e-beautything.com/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "profileImageUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/profile-images/profile-test.webp",
    "bookingPreferences": {
      "skinType": "normal",
      "allergyInfo": "none"
    }
  }'

# Expected response:
{
  "success": true,
  "data": {
    "profile": {
      "profileImageUrl": "https://...",
      "bookingPreferences": {...}
    }
  }
}
```

### Test Profile Retrieval
```bash
# Test 3: Get profile to verify image URL is saved
curl https://api.e-beautything.com/api/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Should return:
{
  "success": true,
  "data": {
    "profile": {
      "profileImageUrl": "https://...", // ← Should NOT be undefined
      ...
    }
  }
}
```

## Supabase Storage Configuration

### Required Storage Bucket Setup
The backend expects a Supabase Storage bucket named `profile-images` with:

1. **Bucket exists**: `profile-images`
2. **Public access**: Enabled
3. **File size limit**: At least 5MB
4. **Allowed mime types**: image/jpeg, image/png, image/webp

### Verify Supabase Storage
```sql
-- Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'profile-images';

-- Check bucket policies
SELECT * FROM storage.policies WHERE bucket_id = 'profile-images';
```

## Next Steps

1. **Frontend Team**:
   - Add logging to image upload function
   - Verify the upload endpoint URL is correct
   - Verify the field name is 'image' (not 'avatar')
   - Ensure imageUrl from upload response is used in profile update
   - Handle upload errors gracefully

2. **Backend Verification**:
   - Check Supabase Storage bucket exists and is public
   - Monitor backend logs during upload attempts:
     ```bash
     tail -f logs/combined.log | grep -i "profile\|image\|upload"
     ```

3. **Test Scenario**:
   - User selects image → Upload to `/api/users/profile/image`
   - Receive imageUrl → Store in frontend state
   - Update profile → Send imageUrl in `/api/users/profile` request
   - Verify profile retrieval returns the imageUrl

## Common Issues & Solutions

### Issue: "Only image files are allowed"
**Solution**: Ensure file MIME type starts with `image/`

### Issue: "Image file size must be less than 5MB"
**Solution**: Compress image on frontend before upload

### Issue: "Failed to upload image" (Supabase Storage error)
**Solution**:
- Verify bucket exists
- Check bucket permissions
- Ensure Supabase API keys are correct

### Issue: "profileImageUrl returns undefined"
**Solution**:
- Verify image upload succeeded first
- Check if frontend is using the returned imageUrl
- Verify profile update includes the imageUrl

---

**Status**: Backend implementation is correct and complete. Issue is on the frontend - image upload is not being called or the URL is not being used in the profile update.

**Last Updated**: 2025-11-22 (UTC)
