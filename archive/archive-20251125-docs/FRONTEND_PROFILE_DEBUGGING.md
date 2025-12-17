# Frontend Profile Edit Page - Debugging Guide

## Issue

After saving profile data, when navigating to `/profile/edit`, the form fields are empty. No profile data is displayed.

---

## Backend Status: ✅ WORKING CORRECTLY

The backend at `http://localhost:3001/api/users/profile` is:
- ✅ Returning 200 OK responses
- ✅ Including all profile fields
- ✅ Including `bookingPreferences` in camelCase format
- ✅ Successfully saving profile updates

**Backend logs confirm:**
```
✅ [12:25:50] PUT /api/users/profile 200 - 576ms  (SAVE SUCCESS)
✅ [12:25:59] GET /api/users/profile 200 - 264ms  (GET SUCCESS)
✅ [12:26:00] GET /api/users/profile 200 - 959ms  (GET SUCCESS)
✅ [12:31:23] GET /api/users/profile 200 - 482ms  (GET SUCCESS)
```

**Example API Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "ab60a268-ddff-47ca-b605-fd7830c9560a",
      "email": "testuser@example.com",
      "phoneNumber": "010123123",
      "name": "sadf",
      "gender": "male",
      "birthDate": "1920-02-02",
      "profileImageUrl": "https://i.imgur.com/lMNiOrG.png",
      "bookingPreferences": {
        "skinType": "normal",
        "allergyInfo": "asdf",
        "preferredStylist": "asdf",
        "specialRequests": "sadf"
      },
      ...
    }
  },
  "message": "프로필 정보를 성공적으로 조회했습니다."
}
```

---

## Frontend Checklist: ⚠️ NEEDS INVESTIGATION

Since the backend is working, the issue is in the **frontend** (port 3003). Check these:

### 1. **API Call on Page Load**

Does `/profile/edit` page fetch user data when it loads?

```typescript
// Example: Should have something like this in useEffect
useEffect(() => {
  const fetchProfile = async () => {
    const response = await fetch('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    setFormData(data.data.profile); // ⚠️ Check this path
  };

  fetchProfile();
}, []);
```

**Check:**
- [ ] Is `useEffect` calling the profile API?
- [ ] Is it running on component mount?
- [ ] Are there any conditions preventing the API call?

---

### 2. **Response Data Path**

The backend returns data nested under `data.profile`:

```json
{
  "success": true,
  "data": {
    "profile": {      // ⬅️ Data is here!
      "name": "...",
      "bookingPreferences": {...}
    }
  }
}
```

**Check:**
- [ ] Is frontend accessing `response.data.profile`?
- [ ] Or is it incorrectly looking for `response.profile`?
- [ ] Console log the response to verify path

```typescript
// CORRECT:
const profile = response.data.profile;

// WRONG:
const profile = response.profile;  // ❌ undefined!
```

---

### 3. **Form Field Binding**

Are form inputs bound to the correct state variables?

```typescript
// State
const [formData, setFormData] = useState({
  name: '',
  birthDate: '',
  gender: '',
  bookingPreferences: {
    skinType: '',
    allergyInfo: '',
    preferredStylist: '',
    specialRequests: ''
  }
});

// Input binding - CORRECT:
<input
  value={formData.name}           // ✅ Bound to state
  onChange={(e) => setFormData({...formData, name: e.target.value})}
/>

// WRONG:
<input value={profile.name} />    // ❌ If profile is not in state
```

**Check:**
- [ ] Are inputs bound to state with `value={formData.field}`?
- [ ] Do inputs have `onChange` handlers updating state?
- [ ] Is state initialized with empty values?

---

### 4. **Browser Console Errors**

Open browser DevTools (F12) and check:

**Console Tab:**
- [ ] Any JavaScript errors?
- [ ] API call failures?
- [ ] Undefined variable errors?

**Network Tab:**
- [ ] Does `GET /api/users/profile` show up?
- [ ] What's the status code? (should be 200)
- [ ] What's the response body? (should have profile data)
- [ ] Is the request sent with correct Authorization header?

---

### 5. **State Update After Save**

After saving, does the form:
1. **Navigate away** (e.g., to `/profile`)?
2. **Stay on edit page** and refresh data?
3. **Clear the form** accidentally?

```typescript
// After save - GOOD:
const handleSave = async () => {
  await updateProfile(formData);
  // Option A: Navigate away
  router.push('/profile');

  // Option B: Refresh data
  await fetchProfile();
};

// After save - BAD:
const handleSave = async () => {
  await updateProfile(formData);
  setFormData({});  // ❌ Clears form!
};
```

**Check:**
- [ ] What happens after clicking save?
- [ ] Does it navigate to another page?
- [ ] Does it stay on edit page?
- [ ] Does it clear the form?

---

### 6. **Response Data Format**

Backend uses **camelCase** for all fields:

```json
{
  "birthDate": "1920-02-02",          // ✅ camelCase
  "phoneNumber": "010123123",          // ✅ camelCase
  "profileImageUrl": "https://...",    // ✅ camelCase
  "bookingPreferences": {              // ✅ camelCase
    "skinType": "normal",              // ✅ camelCase
    "allergyInfo": "asdf"              // ✅ camelCase
  }
}
```

**Check:**
- [ ] Is frontend expecting camelCase?
- [ ] Or is it looking for snake_case (`birth_date`)?

---

### 7. **Component Lifecycle**

Is the component re-rendering correctly?

```typescript
// Debug: Add console logs
useEffect(() => {
  console.log('🔍 ProfileEdit mounted, fetching data...');
  fetchProfile();
}, []);

useEffect(() => {
  console.log('📝 Form data updated:', formData);
}, [formData]);
```

**Check:**
- [ ] Does "ProfileEdit mounted" log appear?
- [ ] Does "Form data updated" log appear with data?
- [ ] Are there multiple re-renders clearing data?

---

### 8. **Token/Authentication**

Is the API call authenticated?

```typescript
// Headers should include:
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

**Check:**
- [ ] Is token available in storage/context?
- [ ] Is token being sent in headers?
- [ ] Is token valid (not expired)?
- [ ] Check Network tab for 401 errors

---

## Quick Debugging Steps

### Step 1: Check if API is being called
```typescript
// In profile/edit page component
useEffect(() => {
  console.log('🔍 [DEBUG] Component mounted');
  console.log('🔍 [DEBUG] Fetching profile...');

  fetch('http://localhost:3001/api/users/profile', {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  .then(res => {
    console.log('🔍 [DEBUG] Response status:', res.status);
    return res.json();
  })
  .then(data => {
    console.log('🔍 [DEBUG] Response data:', data);
    console.log('🔍 [DEBUG] Profile object:', data.data.profile);
  })
  .catch(err => {
    console.error('❌ [DEBUG] Error:', err);
  });
}, []);
```

### Step 2: Check form binding
```typescript
// Log whenever formData changes
useEffect(() => {
  console.log('📝 [DEBUG] Form data:', formData);
}, [formData]);
```

### Step 3: Check save behavior
```typescript
const handleSave = async () => {
  console.log('💾 [DEBUG] Saving with data:', formData);

  const response = await fetch('/api/users/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  });

  const result = await response.json();
  console.log('💾 [DEBUG] Save result:', result);

  // ⚠️ Check what happens here - does it navigate? refresh? clear?
};
```

---

## Expected Console Output (Working Correctly)

When working correctly, you should see:

```
🔍 [DEBUG] Component mounted
🔍 [DEBUG] Fetching profile...
🔍 [DEBUG] Response status: 200
🔍 [DEBUG] Response data: {success: true, data: {profile: {...}}}
🔍 [DEBUG] Profile object: {id: "...", name: "sadf", bookingPreferences: {...}}
📝 [DEBUG] Form data: {name: "sadf", bookingPreferences: {skinType: "normal", ...}}
```

---

## Common Issues & Solutions

### Issue: "Form is empty after saving"

**Cause:** Form is being cleared or state is reset after save

**Solution:**
```typescript
// Don't clear form after save
const handleSave = async () => {
  await updateProfile(formData);
  // ❌ DON'T DO THIS:
  // setFormData({});

  // ✅ DO THIS instead:
  router.push('/profile');  // Navigate away
  // OR
  await fetchProfile();     // Refresh with latest data
};
```

---

### Issue: "Data loads but doesn't show in form"

**Cause:** Form inputs not bound to state

**Solution:**
```typescript
// Make sure inputs use value prop:
<input
  value={formData.name}  // ✅ Bound to state
  onChange={(e) => setFormData({...formData, name: e.target.value})}
/>
```

---

### Issue: "API returns data but state doesn't update"

**Cause:** Incorrect data path or setState not called

**Solution:**
```typescript
const fetchProfile = async () => {
  const response = await fetch('/api/users/profile');
  const data = await response.json();

  // ❌ WRONG:
  // setFormData(data.profile);  // undefined!

  // ✅ CORRECT:
  setFormData(data.data.profile);  // Nested under data.profile
};
```

---

### Issue: "bookingPreferences missing"

**Cause:** Not spreading nested object correctly

**Solution:**
```typescript
// When setting form data:
setFormData({
  ...data.data.profile,  // Spreads all fields including bookingPreferences
});

// When updating bookingPreferences:
setFormData({
  ...formData,
  bookingPreferences: {
    ...formData.bookingPreferences,  // Keep existing fields
    skinType: newValue  // Update specific field
  }
});
```

---

## Backend API Reference

### GET /api/users/profile

**Request:**
```http
GET http://localhost:3001/api/users/profile
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "email": "user@example.com",
      "phoneNumber": "01012345678",
      "name": "User Name",
      "nickname": "Nickname",
      "gender": "male" | "female" | "other",
      "birthDate": "YYYY-MM-DD",
      "profileImageUrl": "https://...",
      "bookingPreferences": {
        "skinType": "normal" | "dry" | "oily" | "combination" | "sensitive",
        "allergyInfo": "string",
        "preferredStylist": "string",
        "specialRequests": "string"
      },
      "userRole": "user",
      "userStatus": "active",
      "totalPoints": 0,
      "availablePoints": 0,
      "referralCode": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  },
  "message": "프로필 정보를 성공적으로 조회했습니다."
}
```

---

### PUT /api/users/profile

**Request:**
```http
PUT http://localhost:3001/api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Name",
  "birthDate": "1990-01-01",
  "gender": "male",
  "bookingPreferences": {
    "skinType": "oily",
    "allergyInfo": "None",
    "preferredStylist": "김미용사",
    "specialRequests": "Please be gentle"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "profile": { /* updated profile */ }
  },
  "message": "프로필이 성공적으로 업데이트되었습니다."
}
```

---

## Summary

**Backend:** ✅ Working perfectly - returning all data including bookingPreferences

**Frontend:** ⚠️ Not displaying data - needs debugging

**Most Likely Issues:**
1. Not fetching data on page load
2. Incorrect response data path (`data.profile` vs `profile`)
3. Form inputs not bound to state
4. State being cleared after save

**Next Steps:**
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for API calls
4. Add debug console.logs as shown above
5. Verify data path: `response.data.profile`
6. Verify form inputs have `value={formData.field}`

---

**Status:** Backend is ready. Frontend needs fixes. 🎯
