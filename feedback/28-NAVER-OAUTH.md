# Plan 28: Naver OAuth Integration

## Overview
This plan implements Naver social login integration, allowing users to sign up and log in using their Naver accounts. This adds to the existing OAuth providers (Kakao, Google, Apple) and addresses Phase 6.1 feedback from IMPLEMENTATION_PLAN.md.

**Feedback Item Addressed:**
- 회원가입할 때 네이버 로그인 추가

---

## 1. Prerequisites

### 1.1 Naver Developer Console Setup

1. Go to https://developers.naver.com/apps
2. Create new application
3. Select "네이버 로그인" API
4. Configure OAuth settings:
   - **Callback URL (Production)**: `https://api.e-beautything.com/api/auth/naver/callback`
   - **Callback URL (Development)**: `http://localhost:3001/api/auth/naver/callback`
5. Request permissions:
   - 회원이름 (nickname)
   - 이메일 주소 (email)
   - 프로필 사진 (profile_image)
6. Get Client ID and Client Secret

### 1.2 Environment Variables

**Backend `.env`:**
```bash
# Naver OAuth
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
NAVER_CALLBACK_URL=https://api.e-beautything.com/api/auth/naver/callback
```

**Mobile App `.env`:**
```bash
# Naver OAuth
NEXT_PUBLIC_NAVER_CLIENT_ID=your_naver_client_id
```

---

## 2. Database Schema

The existing `users` table should already support social auth providers. Verify or add:

```sql
-- Verify users table has these columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS naver_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(100);

-- Create index for Naver ID lookups
CREATE INDEX IF NOT EXISTS idx_users_naver_id ON users(naver_id);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
```

---

## 3. Backend Implementation

### 3.1 OAuth Configuration

**File: `src/config/oauth.config.ts`** (Update)

```typescript
export const oauthConfig = {
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID!,
    clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    callbackUrl: process.env.KAKAO_CALLBACK_URL!,
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL!,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
    keyId: process.env.APPLE_KEY_ID!,
    privateKey: process.env.APPLE_PRIVATE_KEY!,
    callbackUrl: process.env.APPLE_CALLBACK_URL!,
  },
  naver: {
    clientId: process.env.NAVER_CLIENT_ID!,
    clientSecret: process.env.NAVER_CLIENT_SECRET!,
    callbackUrl: process.env.NAVER_CALLBACK_URL!,
    authorizationUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    userInfoUrl: 'https://openapi.naver.com/v1/nid/me',
  },
};
```

### 3.2 Naver Auth Types

**File: `src/types/naver-auth.types.ts`** (New)

```typescript
export interface NaverTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface NaverUserInfo {
  resultcode: string;
  message: string;
  response: {
    id: string;
    nickname?: string;
    profile_image?: string;
    email?: string;
    name?: string;
    birthday?: string;
    birthyear?: string;
    mobile?: string;
    gender?: 'M' | 'F' | 'U';
    age?: string;
  };
}

export interface NaverAuthState {
  redirect?: string;
  referralCode?: string;
}
```

### 3.3 Naver Auth Service

**File: `src/services/naver-auth.service.ts`** (New)

```typescript
import axios from 'axios';
import { oauthConfig } from '@/config/oauth.config';
import { NaverTokenResponse, NaverUserInfo, NaverAuthState } from '@/types/naver-auth.types';
import { supabase } from '@/config/supabase';
import { JWTService } from '@/services/jwt.service';
import { UserService } from '@/services/user.service';
import crypto from 'crypto';

export class NaverAuthService {
  private jwtService: JWTService;
  private userService: UserService;

  constructor() {
    this.jwtService = new JWTService();
    this.userService = new UserService();
  }

  /**
   * Generate Naver OAuth authorization URL
   */
  generateAuthUrl(state?: NaverAuthState): string {
    const { clientId, callbackUrl, authorizationUrl } = oauthConfig.naver;

    // Encode state as base64 JSON if provided
    const stateParam = state
      ? Buffer.from(JSON.stringify(state)).toString('base64')
      : crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      state: stateParam,
    });

    return `${authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string, state: string): Promise<NaverTokenResponse> {
    const { clientId, clientSecret, tokenUrl } = oauthConfig.naver;

    try {
      const response = await axios.get<NaverTokenResponse>(tokenUrl, {
        params: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state,
        },
      });

      if (response.data.error) {
        throw new Error(`Naver OAuth error: ${response.data.error_description}`);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get Naver access token: ${error.message}`);
    }
  }

  /**
   * Get user info from Naver
   */
  async getUserInfo(accessToken: string): Promise<NaverUserInfo['response']> {
    const { userInfoUrl } = oauthConfig.naver;

    try {
      const response = await axios.get<NaverUserInfo>(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data.resultcode !== '00') {
        throw new Error(`Naver API error: ${response.data.message}`);
      }

      return response.data.response;
    } catch (error: any) {
      throw new Error(`Failed to get Naver user info: ${error.message}`);
    }
  }

  /**
   * Handle Naver OAuth callback
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
  }> {
    // Get access token
    const tokenResponse = await this.getAccessToken(code, state);

    // Get user info
    const naverUser = await this.getUserInfo(tokenResponse.access_token);

    if (!naverUser.id) {
      throw new Error('Failed to get Naver user ID');
    }

    // Check if user exists by Naver ID
    let { data: existingUser, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('naver_id', naverUser.id)
      .single();

    let isNewUser = false;

    if (!existingUser) {
      // Check if email exists (for account linking)
      if (naverUser.email) {
        const { data: emailUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', naverUser.email)
          .single();

        if (emailUser) {
          // Link Naver account to existing user
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
              naver_id: naverUser.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', emailUser.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to link Naver account: ${updateError.message}`);
          }

          existingUser = updatedUser;
        }
      }
    }

    if (!existingUser) {
      // Create new user
      isNewUser = true;

      // Parse state for referral code
      let referralCode: string | undefined;
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString()) as NaverAuthState;
        referralCode = stateData.referralCode;
      } catch {
        // State is not JSON, ignore
      }

      // Generate nickname if not provided
      const nickname = naverUser.nickname || `User${Date.now().toString(36)}`;

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: naverUser.email,
          nickname,
          profile_image: naverUser.profile_image,
          naver_id: naverUser.id,
          provider: 'naver',
          provider_id: naverUser.id,
          referral_code: referralCode,
          email_verified: !!naverUser.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      existingUser = newUser;

      // Handle referral if provided
      if (referralCode) {
        await this.userService.processReferral(newUser.id, referralCode);
      }
    }

    // Generate JWT tokens
    const accessToken = this.jwtService.generateAccessToken({
      userId: existingUser.id,
      email: existingUser.email,
    });

    const refreshToken = this.jwtService.generateRefreshToken({
      userId: existingUser.id,
    });

    // Save refresh token
    await supabase
      .from('refresh_tokens')
      .insert({
        user_id: existingUser.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });

    return {
      user: existingUser,
      accessToken,
      refreshToken,
      isNewUser,
    };
  }

  /**
   * Unlink Naver account
   */
  async unlinkAccount(userId: string): Promise<void> {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('naver_id, provider')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      throw new Error('User not found');
    }

    if (!user.naver_id) {
      throw new Error('No Naver account linked');
    }

    // Check if user has other login methods
    const hasPassword = await this.userService.hasPassword(userId);
    const { data: otherProviders } = await supabase
      .from('users')
      .select('kakao_id, google_id, apple_id')
      .eq('id', userId)
      .single();

    const hasOtherProvider = otherProviders &&
      (otherProviders.kakao_id || otherProviders.google_id || otherProviders.apple_id);

    if (!hasPassword && !hasOtherProvider) {
      throw new Error('Cannot unlink: no other login method available');
    }

    // Unlink Naver account
    const { error: updateError } = await supabase
      .from('users')
      .update({
        naver_id: null,
        provider: user.provider === 'naver' ? null : user.provider,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to unlink Naver account: ${updateError.message}`);
    }
  }
}
```

### 3.4 Auth Controller Update

**File: `src/controllers/auth.controller.ts`** (Update)

```typescript
import { Request, Response } from 'express';
import { NaverAuthService } from '@/services/naver-auth.service';
import { successResponse, errorResponse } from '@/utils/response';

const naverAuthService = new NaverAuthService();

export class AuthController {
  // ... existing methods ...

  /**
   * GET /api/auth/naver
   * Redirect to Naver OAuth
   */
  async naverAuth(req: Request, res: Response) {
    try {
      const { redirect, referralCode } = req.query;

      const authUrl = naverAuthService.generateAuthUrl({
        redirect: redirect as string,
        referralCode: referralCode as string,
      });

      return res.redirect(authUrl);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * GET /api/auth/naver/callback
   * Handle Naver OAuth callback
   */
  async naverCallback(req: Request, res: Response) {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        return errorResponse(res, error_description as string || 'Naver login failed', 400);
      }

      if (!code || !state) {
        return errorResponse(res, 'Missing code or state', 400);
      }

      const result = await naverAuthService.handleCallback(
        code as string,
        state as string
      );

      // Parse state for redirect URL
      let redirectUrl = process.env.APP_URL || 'https://app.e-beautything.com';
      try {
        const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
        if (stateData.redirect) {
          redirectUrl = stateData.redirect;
        }
      } catch {
        // State is not JSON, use default redirect
      }

      // Build redirect URL with tokens
      const params = new URLSearchParams({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        is_new_user: result.isNewUser.toString(),
      });

      return res.redirect(`${redirectUrl}/auth/callback?${params.toString()}`);
    } catch (error: any) {
      // Redirect to error page
      const errorUrl = `${process.env.APP_URL}/auth/error?message=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
  }

  /**
   * POST /api/auth/naver/token
   * Exchange Naver token for app tokens (mobile SDK flow)
   */
  async naverToken(req: Request, res: Response) {
    try {
      const { accessToken, referralCode } = req.body;

      if (!accessToken) {
        return errorResponse(res, 'Access token is required', 400);
      }

      // Get user info from Naver
      const naverUser = await naverAuthService.getUserInfo(accessToken);

      // Handle user creation/lookup (similar to callback flow)
      // This is for mobile SDK flow where the app handles OAuth directly
      const result = await naverAuthService.handleCallback(
        accessToken, // Use access token as code
        Buffer.from(JSON.stringify({ referralCode })).toString('base64')
      );

      return successResponse(res, {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: result.isNewUser,
      });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * DELETE /api/auth/naver/unlink
   * Unlink Naver account
   */
  async naverUnlink(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      await naverAuthService.unlinkAccount(userId);

      return successResponse(res, { message: 'Naver account unlinked successfully' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

### 3.5 Auth Routes Update

**File: `src/routes/auth.routes.ts`** (Update)

```typescript
import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';

const router = Router();
const controller = new AuthController();

// Existing routes...
router.post('/login', controller.login.bind(controller));
router.post('/register', controller.register.bind(controller));
router.post('/refresh', controller.refresh.bind(controller));
router.post('/logout', authenticate, controller.logout.bind(controller));

// Kakao OAuth
router.get('/kakao', controller.kakaoAuth.bind(controller));
router.get('/kakao/callback', controller.kakaoCallback.bind(controller));
router.post('/kakao/token', controller.kakaoToken.bind(controller));

// Google OAuth
router.get('/google', controller.googleAuth.bind(controller));
router.get('/google/callback', controller.googleCallback.bind(controller));

// Apple OAuth
router.post('/apple/callback', controller.appleCallback.bind(controller));

// Naver OAuth (NEW)
router.get('/naver', controller.naverAuth.bind(controller));
router.get('/naver/callback', controller.naverCallback.bind(controller));
router.post('/naver/token', controller.naverToken.bind(controller));
router.delete('/naver/unlink', authenticate, controller.naverUnlink.bind(controller));

export default router;
```

---

## 4. Mobile App Implementation

### 4.1 Naver Login Button Component

**File: `src/components/auth/NaverLoginButton.tsx`** (New)

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NaverLoginButtonProps {
  className?: string;
  onSuccess?: (data: { accessToken: string; refreshToken: string; isNewUser: boolean }) => void;
  onError?: (error: Error) => void;
  referralCode?: string;
}

export function NaverLoginButton({
  className,
  onSuccess,
  onError,
  referralCode,
}: NaverLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleNaverLogin = () => {
    setIsLoading(true);

    try {
      // Build OAuth URL
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const redirectUrl = `${window.location.origin}/auth/callback`;

      // Encode state with referral code and redirect
      const state = btoa(JSON.stringify({
        redirect: redirectUrl,
        referralCode,
      }));

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
        redirect_uri: `${baseUrl}/auth/naver/callback`,
        state,
      });

      // Redirect to Naver OAuth
      window.location.href = `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
    } catch (error: any) {
      setIsLoading(false);
      onError?.(error);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'w-full bg-[#03C75A] hover:bg-[#02B350] text-white border-0',
        'flex items-center justify-center gap-2',
        className
      )}
      onClick={handleNaverLogin}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <>
          {/* Naver Logo */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.5 10.5L6.5 3H3V17H6.5V9.5L13.5 17H17V3H13.5V10.5Z"
              fill="white"
            />
          </svg>
          <span>네이버로 시작하기</span>
        </>
      )}
    </Button>
  );
}
```

### 4.2 Login Page Update

**File: `src/app/(auth)/login/page.tsx`** (Update)

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { KakaoLoginButton } from '@/components/auth/KakaoLoginButton';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { AppleLoginButton } from '@/components/auth/AppleLoginButton';
import { NaverLoginButton } from '@/components/auth/NaverLoginButton';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      router.push('/');
    } catch (error: any) {
      toast.error(error.message || '로그인에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLoginSuccess = () => {
    router.push('/');
  };

  const handleSocialLoginError = (error: Error) => {
    toast.error(error.message || '소셜 로그인에 실패했습니다');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">eBeautything</h1>
          <p className="text-gray-500 mt-2">로그인하고 시작하세요</p>
        </div>

        {/* Social Login Buttons */}
        <div className="space-y-3 mb-6">
          <KakaoLoginButton
            onSuccess={handleSocialLoginSuccess}
            onError={handleSocialLoginError}
            referralCode={referralCode || undefined}
          />
          <NaverLoginButton
            onSuccess={handleSocialLoginSuccess}
            onError={handleSocialLoginError}
            referralCode={referralCode || undefined}
          />
          <GoogleLoginButton
            onSuccess={handleSocialLoginSuccess}
            onError={handleSocialLoginError}
            referralCode={referralCode || undefined}
          />
          <AppleLoginButton
            onSuccess={handleSocialLoginSuccess}
            onError={handleSocialLoginError}
            referralCode={referralCode || undefined}
          />
        </div>

        <div className="relative mb-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-sm text-gray-500">
            또는
          </span>
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호"
              {...register('password')}
              error={errors.password?.message}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="text-blue-600 hover:underline">
            비밀번호 찾기
          </Link>
          <span className="mx-2 text-gray-300">|</span>
          <Link href="/register" className="text-blue-600 hover:underline">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 Auth Callback Page

**File: `src/app/auth/callback/page.tsx`** (Update)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const isNewUser = searchParams.get('is_new_user') === 'true';
    const errorMessage = searchParams.get('message');

    if (errorMessage) {
      setError(errorMessage);
      return;
    }

    if (accessToken && refreshToken) {
      // Set tokens
      setTokens(accessToken, refreshToken);

      // Redirect
      if (isNewUser) {
        // New user - might want to show onboarding
        router.replace('/welcome');
      } else {
        router.replace('/');
      }
    } else {
      setError('인증 정보를 받지 못했습니다');
    }
  }, [searchParams, setTokens, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-500 mb-2">로그인 실패</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-blue-600 hover:underline"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
      <p className="text-gray-600">로그인 처리 중...</p>
    </div>
  );
}
```

### 4.4 Settings Page - Linked Accounts

**File: `src/components/settings/LinkedAccounts.tsx`** (New)

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Check, Link as LinkIcon, Unlink } from 'lucide-react';
import { authApi } from '@/lib/api/auth-api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LinkedAccountsProps {
  user: {
    kakaoId?: string;
    naverId?: string;
    googleId?: string;
    appleId?: string;
  };
}

const providers = [
  {
    id: 'kakao',
    name: '카카오',
    color: 'bg-[#FEE500]',
    textColor: 'text-black',
    fieldKey: 'kakaoId',
  },
  {
    id: 'naver',
    name: '네이버',
    color: 'bg-[#03C75A]',
    textColor: 'text-white',
    fieldKey: 'naverId',
  },
  {
    id: 'google',
    name: '구글',
    color: 'bg-white border',
    textColor: 'text-gray-700',
    fieldKey: 'googleId',
  },
  {
    id: 'apple',
    name: 'Apple',
    color: 'bg-black',
    textColor: 'text-white',
    fieldKey: 'appleId',
  },
];

export function LinkedAccounts({ user }: LinkedAccountsProps) {
  const queryClient = useQueryClient();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  const unlinkMutation = useMutation({
    mutationFn: (provider: string) => authApi.unlinkSocialAccount(provider),
    onSuccess: (_, provider) => {
      toast.success(`${providers.find(p => p.id === provider)?.name} 연결이 해제되었습니다`);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (error: any) => {
      toast.error(error.message || '연결 해제에 실패했습니다');
    },
    onSettled: () => {
      setUnlinkingProvider(null);
    },
  });

  const handleLink = (provider: string) => {
    // Redirect to OAuth flow
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const redirectUrl = `${window.location.origin}/settings?linked=${provider}`;

    window.location.href = `${baseUrl}/auth/${provider}?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleUnlink = (provider: string) => {
    setUnlinkingProvider(provider);
    unlinkMutation.mutate(provider);
  };

  const linkedCount = providers.filter(p => user[p.fieldKey as keyof typeof user]).length;

  return (
    <Card className="p-4">
      <h3 className="font-medium mb-4">연결된 계정</h3>
      <div className="space-y-3">
        {providers.map((provider) => {
          const isLinked = !!user[provider.fieldKey as keyof typeof user];
          const isUnlinking = unlinkingProvider === provider.id;
          const canUnlink = linkedCount > 1 || isLinked; // Allow unlink if has other methods

          return (
            <div
              key={provider.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    provider.color
                  )}
                >
                  <span className={cn('text-sm font-bold', provider.textColor)}>
                    {provider.name.charAt(0)}
                  </span>
                </div>
                <span className="font-medium">{provider.name}</span>
                {isLinked && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </div>

              {isLinked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlink(provider.id)}
                  disabled={isUnlinking || (linkedCount === 1)}
                  className="text-red-500 hover:text-red-600"
                >
                  {isUnlinking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-1" />
                      해제
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLink(provider.id)}
                >
                  <LinkIcon className="w-4 h-4 mr-1" />
                  연결
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {linkedCount === 1 && (
        <p className="text-xs text-gray-500 mt-4">
          * 마지막 로그인 방법은 해제할 수 없습니다
        </p>
      )}
    </Card>
  );
}
```

### 4.5 API Client Update

**File: `src/lib/api/auth-api.ts`** (Update)

```typescript
import { apiClient } from './client';

export const authApi = {
  // ... existing methods ...

  // Naver OAuth token exchange (for mobile SDK flow)
  naverLogin: async (accessToken: string, referralCode?: string) => {
    const { data } = await apiClient.post('/auth/naver/token', {
      accessToken,
      referralCode,
    });
    return data.data;
  },

  // Unlink social account
  unlinkSocialAccount: async (provider: string) => {
    const { data } = await apiClient.delete(`/auth/${provider}/unlink`);
    return data.data;
  },

  // Get linked accounts
  getLinkedAccounts: async () => {
    const { data } = await apiClient.get('/auth/linked-accounts');
    return data.data;
  },
};
```

---

## 5. Files Summary

### New Files

**Backend:**
- `src/types/naver-auth.types.ts`
- `src/services/naver-auth.service.ts`

**Mobile App:**
- `src/components/auth/NaverLoginButton.tsx`
- `src/components/settings/LinkedAccounts.tsx`

### Modified Files

**Backend:**
- `src/config/oauth.config.ts`
- `src/controllers/auth.controller.ts`
- `src/routes/auth.routes.ts`
- `.env` (add Naver credentials)

**Mobile App:**
- `src/app/(auth)/login/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/lib/api/auth-api.ts`
- `.env` (add Naver client ID)

---

## 6. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/naver` | Redirect to Naver OAuth |
| GET | `/api/auth/naver/callback` | Handle Naver OAuth callback |
| POST | `/api/auth/naver/token` | Exchange Naver token (mobile SDK) |
| DELETE | `/api/auth/naver/unlink` | Unlink Naver account |

---

## 7. Naver OAuth Flow

### Web Flow
```
1. User clicks "네이버로 시작하기" button
2. App redirects to GET /api/auth/naver
3. Backend redirects to Naver OAuth
4. User authorizes app on Naver
5. Naver redirects to /api/auth/naver/callback
6. Backend exchanges code for tokens
7. Backend creates/links user
8. Backend redirects to app with JWT tokens
9. App stores tokens and completes login
```

### Mobile SDK Flow (Alternative)
```
1. Mobile app uses Naver SDK to get access token
2. App sends access token to POST /api/auth/naver/token
3. Backend verifies token with Naver
4. Backend creates/links user
5. Backend returns JWT tokens
6. App completes login
```

---

## 8. Security Considerations

1. **State Parameter**: Always use state parameter to prevent CSRF attacks
2. **Token Storage**: Store refresh tokens securely, never in localStorage
3. **HTTPS**: All OAuth endpoints must use HTTPS in production
4. **Scope Minimization**: Only request necessary permissions
5. **Token Expiry**: Handle token refresh properly
6. **Account Linking**: Verify email before linking accounts

---

## 9. Testing Checklist

- [ ] User can log in with new Naver account
- [ ] User can link Naver to existing account
- [ ] User can unlink Naver account (if has other login method)
- [ ] Cannot unlink last login method
- [ ] Referral code is processed for new Naver users
- [ ] State parameter prevents CSRF
- [ ] Error handling shows appropriate messages
- [ ] Mobile SDK flow works correctly
- [ ] Naver button has correct styling
- [ ] Linked accounts display correctly in settings
