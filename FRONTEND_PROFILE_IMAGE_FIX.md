# Frontend Profile Image Fix Guide

## Issue Summary
Profile images are not saving because the frontend is **not uploading images to the backend** before updating the profile.

## Root Cause
Frontend logs show:
```javascript
[Profile Edit] Sending update data: {
  "name": "asdf",
  "bookingPreferences": {...}
  // ❌ profileImageUrl is MISSING!
}
```

The backend is working correctly, but the frontend is not sending `profileImageUrl` in the profile update request.

## Backend Status: ✅ ALL WORKING

Confirmed via automated tests:
- ✅ Profile retrieval: Working
- ✅ Profile update: Working
- ✅ bookingPreferences saved: Working
- ✅ Case transformation (snake_case ↔ camelCase): Working
- ✅ Supabase Storage bucket: Exists and public
- ✅ Image upload endpoint: Ready

## Required Frontend Changes

### Step 1: Implement Image Upload

Add the image upload API call **BEFORE** the profile update:

```typescript
// File: Your profile edit component

async function uploadProfileImage(imageFile: File): Promise<string | null> {
  try {
    console.log('[Profile Image] Uploading image...');

    const formData = new FormData();
    formData.append('image', imageFile); // ⚠️ Must use 'image', not 'avatar'

    const response = await fetch('https://api.e-beautything.com/api/users/profile/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}` // Your auth token
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Profile Image] Upload failed:', error);
      throw new Error(error.message || 'Image upload failed');
    }

    const result = await response.json();
    console.log('[Profile Image] Upload successful:', result);

    // ✅ Backend returns imageUrl in camelCase (thanks to transformResponseMiddleware)
    return result.data.imageUrl;

  } catch (error) {
    console.error('[Profile Image] Upload error:', error);
    // Show error to user
    Alert.alert('Error', 'Failed to upload profile image');
    return null;
  }
}
```

### Step 2: Update Profile Edit Flow

Modify your profile save function to upload the image first:

```typescript
async function handleSaveProfile(formData: ProfileFormData) {
  try {
    let profileImageUrl = currentProfile.profileImageUrl; // Keep existing URL

    // 1. Upload new image if selected
    if (selectedImageFile) {
      console.log('[Profile Edit] Uploading new image...');
      const uploadedUrl = await uploadProfileImage(selectedImageFile);

      if (uploadedUrl) {
        profileImageUrl = uploadedUrl; // Use new URL
        console.log('[Profile Edit] Image uploaded:', uploadedUrl);
      } else {
        console.error('[Profile Edit] Image upload failed, using existing URL');
      }
    }

    // 2. Prepare profile update data
    const updateData = {
      name: formData.name,
      profileImageUrl, // ✅ Include image URL
      bookingPreferences: {
        skinType: formData.skinType,
        allergyInfo: formData.allergyInfo,
        preferredStylist: formData.preferredStylist,
        specialRequests: formData.specialRequests
      }
    };

    console.log('[Profile Edit] Sending update data:', updateData);

    // 3. Update profile
    const response = await fetch('https://api.e-beautything.com/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Profile update failed');
    }

    const result = await response.json();
    console.log('[Profile Edit] Profile updated:', result);

    // ✅ result.data.profile.profileImageUrl should now have the URL
    return result.data.profile;

  } catch (error) {
    console.error('[Profile Edit] Save failed:', error);
    Alert.alert('Error', 'Failed to save profile');
  }
}
```

## API Endpoints Reference

### Image Upload
```
POST https://api.e-beautything.com/api/users/profile/image
Content-Type: multipart/form-data
Authorization: Bearer {token}

Body:
  - image: <file> (max 5MB, JPEG/PNG/WebP)

Response (200 OK):
{
  "success": true,
  "data": {
    "imageUrl": "https://ysrudwzwnzxrrwjtpuoh.supabase.co/storage/v1/object/public/profile-images/profile-{userId}-{timestamp}.webp",
    "thumbnailUrl": "https://...",
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

Errors:
- 400: Invalid file or upload failed
- 401: Unauthorized
- 413: File too large (>5MB)
```

### Profile Update
```
PUT https://api.e-beautything.com/api/users/profile
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "name": "User Name",
  "profileImageUrl": "https://...", // ← REQUIRED if you want to save image
  "bookingPreferences": {
    "skinType": "dry",
    "allergyInfo": "none",
    "preferredStylist": "John",
    "specialRequests": "Please be gentle"
  }
}

Response (200 OK):
{
  "success": true,
  "data": {
    "profile": {
      "id": "...",
      "name": "User Name",
      "profileImageUrl": "https://...", // ✅ Now present
      "bookingPreferences": {...}
    },
    "message": "프로필이 성공적으로 업데이트되었습니다."
  }
}
```

## Testing Checklist

### Image Upload
- [ ] Image file is selected from gallery/camera
- [ ] FormData uses field name 'image' (not 'avatar')
- [ ] Authorization header is included
- [ ] Response contains imageUrl
- [ ] imageUrl is stored in component state

### Profile Update
- [ ] profileImageUrl is included in update request
- [ ] bookingPreferences are included
- [ ] Response returns updated profile with profileImageUrl
- [ ] UI shows the uploaded image

### Error Handling
- [ ] Show error if image upload fails
- [ ] Allow user to continue without image if upload fails
- [ ] Show error if profile update fails
- [ ] Retry logic for failed uploads (optional)

## Common Mistakes to Avoid

### ❌ Wrong field name
```typescript
formData.append('avatar', imageFile); // Wrong!
```
✅ **Correct:**
```typescript
formData.append('image', imageFile); // Correct!
```

### ❌ Not waiting for upload to complete
```typescript
uploadProfileImage(file); // No await!
updateProfile(data); // Runs before upload finishes
```
✅ **Correct:**
```typescript
const imageUrl = await uploadProfileImage(file); // Wait for it
updateProfile({ ...data, profileImageUrl: imageUrl });
```

### ❌ Not including imageUrl in profile update
```typescript
await updateProfile({
  name: formData.name,
  bookingPreferences: {...}
  // Missing: profileImageUrl!
});
```
✅ **Correct:**
```typescript
await updateProfile({
  name: formData.name,
  profileImageUrl: uploadedImageUrl, // ✅ Include it!
  bookingPreferences: {...}
});
```

## Backend Logs to Monitor

When testing, check backend logs for:

```bash
# SSH into server
cd /home/bitnami/everything_backend

# Monitor logs in real-time
tail -f logs/combined.log | grep -i "profile\|image\|upload"
```

Expected logs during successful upload:
```
[INFO] Profile image uploaded successfully: { userId: '...', imageUrl: '...', ... }
[INFO] User profile updated successfully: { userId: '...', updatedFields: ['name', 'profile_image_url', 'booking_preferences'] }
```

## Summary

**Issue**: Frontend not uploading images to backend
**Fix**: Add image upload step before profile update
**Backend**: ✅ Already working correctly
**Frontend**: ❌ Needs to call `/api/users/profile/image` endpoint

Once the frontend implements the upload step and includes `profileImageUrl` in the profile update, images will save correctly.

---

**Last Updated**: 2025-11-22 (UTC)
**Tested**: ✅ Backend verified working via automated tests
