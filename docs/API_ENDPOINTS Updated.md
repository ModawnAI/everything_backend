# Admin Login API - Frontend Integration Guide

## ⚠️ IMPORTANT: Response Structure with Axios

When using axios, **all HTTP responses are automatically wrapped in a `data` property**. You must access response fields through `response.data`.

## Admin Login Endpoint

**Endpoint:** `POST /api/admin/auth/login`

**Request:**
```json
{
  "email": "superadmin@ebeautything.com",
  "password": "SuperAdmin2025!"
}
```

### Backend Raw HTTP Response

```json
{
  "success": true,
  "token": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "data": {
    "admin": { ... },
    "session": { ... }
  }
}
```

### What Axios Receives

```javascript
axios.post('/api/admin/auth/login', credentials)
  .then(response => {
    // response.data contains the backend's JSON response
    console.log(response.data);
    /*
    {
      success: true,
      token: "eyJhbGci...",
      refreshToken: "eyJhbGci...",
      data: { admin: {...}, session: {...} }
    }
    */
  });
```

### ✅ CORRECT Frontend Code

```typescript
const response = await axios.post('/api/admin/auth/login', {
  email: 'superadmin@ebeautything.com',
  password: 'SuperAdmin2025!'
});

// ✅ Access tokens from response.data
const { token, refreshToken } = response.data;
const admin = response.data.data.admin;

localStorage.setItem('admin_token', token);
localStorage.setItem('admin_refresh_token', refreshToken);
```

### ❌ WRONG Frontend Code

```typescript
// ❌ This will be undefined!
const { token, refreshToken } = response;

// ❌ This will also be undefined!
const token = response.token;
```

## Complete Working Example

```typescript
import axios from 'axios';

interface AdminLoginResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  data: {
    admin: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    session: {
      token: string;
      refreshToken: string;
      expiresAt: string;
    };
  };
}

async function loginAdmin(email: string, password: string) {
  try {
    const response = await axios.post<AdminLoginResponse>(
      'http://localhost:3001/api/admin/auth/login',
      { email, password }
    );

    // ✅ Extract from response.data
    const { token, refreshToken, data } = response.data;

    if (!token || !refreshToken) {
      throw new Error('Missing authentication tokens');
    }

    // Store tokens
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_refresh_token', refreshToken);

    return {
      success: true,
      admin: data.admin,
      token,
      refreshToken
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error?.message || 'Login failed';
      throw new Error(message);
    }
    throw error;
  }
}
```

## Test Credentials

- **Email:** `superadmin@ebeautything.com`
- **Password:** `SuperAdmin2025!`

## Debugging Response Structure

Add this code to see the exact structure:

```typescript
const response = await axios.post('/api/admin/auth/login', credentials);

console.log('Full response:', {
  status: response.status,
  data: response.data,
  token_location: response.data?.token ? 'response.data.token' : 'NOT FOUND',
  refresh_location: response.data?.refreshToken ? 'response.data.refreshToken' : 'NOT FOUND'
});
```

---

**Last Updated:** 2025-10-06
