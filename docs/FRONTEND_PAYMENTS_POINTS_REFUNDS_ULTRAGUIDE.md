# 🚀 Payments, Points & Refunds - Ultra-Detailed Frontend Integration

## 📋 Table of Contents

1. [Understanding the 403 Error](#understanding-the-403-error)
2. [Complete TypeScript Type System](#complete-typescript-type-system)
3. [API Service Layer Implementation](#api-service-layer-implementation)
4. [React Query Hooks](#react-query-hooks)
5. [Authentication & Authorization](#authentication--authorization)
6. [Component Implementation](#component-implementation)
7. [Payment Flow Implementation](#payment-flow-implementation)
8. [Point System Implementation](#point-system-implementation)
9. [Refund System Implementation](#refund-system-implementation)
10. [Error Handling & Debugging](#error-handling--debugging)
11. [Testing Guide](#testing-guide)

---

## 🔴 Understanding the 403 Error

### Your Current Error

```
❌ GET /api/admin/financial/refunds?page=1&limit=20 403 - 4231.439ms
[API Error] 403 /api/admin/financial/refunds (4247ms) {}
```

### Root Causes

1. **Missing or Invalid Admin Token**
   - Admin endpoints require valid admin JWT token
   - Token must have `role: 'admin'` in payload
   - Token might be expired

2. **Wrong Authorization Header Format**
   ```typescript
   // ❌ WRONG
   headers: { 'Authorization': 'YOUR_TOKEN' }

   // ✅ CORRECT
   headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
   ```

3. **Token Not Sent**
   ```typescript
   // ❌ WRONG - No auth header
   const response = await fetch('/api/admin/financial/refunds');

   // ✅ CORRECT - With auth header
   const response = await fetch('/api/admin/financial/refunds', {
     headers: {
       'Authorization': `Bearer ${getAdminToken()}`
     }
   });
   ```

4. **User is Not an Admin**
   - Token is valid but user role is not 'admin'
   - Backend checks: `req.user?.role === 'admin'`

### How to Fix

```typescript
// 1. Check if token exists
const token = localStorage.getItem('admin_token');
if (!token) {
  // Redirect to login
  router.push('/admin/login');
  return;
}

// 2. Decode token to check expiration
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  adminId: string;
  role: string;
  exp: number;
}

const decoded = jwtDecode<DecodedToken>(token);

// Check if expired
if (decoded.exp * 1000 < Date.now()) {
  // Token expired, redirect to login
  localStorage.removeItem('admin_token');
  router.push('/admin/login');
  return;
}

// Check if admin role
if (decoded.role !== 'admin') {
  // Not an admin, show error
  toast.error('관리자 권한이 필요합니다');
  router.push('/');
  return;
}

// 3. Make request with valid token
const response = await api.get('/admin/financial/refunds', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 📦 Complete TypeScript Type System

### Backend Types (snake_case - Received from API)

```typescript
// src/types/backend/payment.types.ts

/**
 * Backend payment object (snake_case)
 * Received directly from API responses
 */
export interface BackendPayment {
  id: string;
  reservation_id: string;
  user_id: string;
  shop_id: string;
  amount: number;
  currency: string;
  payment_method: 'toss_payments' | 'kakao_pay' | 'naver_pay' | 'card' | 'bank_transfer';
  payment_status: 'pending' | 'deposit_paid' | 'fully_paid' | 'partially_paid' | 'failed' | 'refunded';
  payment_stage: 'deposit' | 'final';
  is_deposit: boolean;
  paid_at: string | null;
  refunded_at: string | null;
  refund_amount: number;
  failure_reason: string | null;
  metadata: Record<string, any> | null;
  version: number;
  reminder_sent_at: string | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Backend payment with nested relationships
 */
export interface BackendPaymentWithRelations extends BackendPayment {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone_number: string | null;
  };
  shop: {
    id: string;
    name: string;
    phone_number: string | null;
  };
  reservation: {
    id: string;
    reservation_date: string;
    reservation_time: string;
    status: string;
    total_amount: number;
  };
}

/**
 * Backend point transaction (snake_case)
 */
export interface BackendPointTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earned_service' | 'earned_referral' | 'influencer_bonus' | 'used_service' | 'adjusted';
  amount: number;
  balance_after: number;
  description: string;
  status: 'completed' | 'pending' | 'cancelled' | 'expired';
  reservation_id: string | null;
  payment_id: string | null;
  expires_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Backend refund (snake_case)
 */
export interface BackendRefund {
  id: string;
  payment_id: string;
  reservation_id: string;
  user_id: string;
  refund_type: 'full' | 'partial';
  refund_reason: 'cancelled_by_customer' | 'service_issue' | 'shop_cancelled' | 'no_show' | 'double_booking' | 'other';
  refund_reason_details: string | null;
  requested_amount: number;
  approved_amount: number | null;
  refunded_amount: number | null;
  refund_status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  refund_method: 'original' | 'bank_transfer' | 'point_return';
  admin_notes: string | null;
  customer_notes: string | null;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  processed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Backend pagination structure
 */
export interface BackendPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_more?: boolean;
}

/**
 * Backend API response wrapper
 */
export interface BackendApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

/**
 * Backend paginated response
 */
export interface BackendPaginatedResponse<T> {
  items: T[];  // Or could be named differently per endpoint
  pagination: BackendPagination;
}
```

### Frontend Types (camelCase - Used in Components)

```typescript
// src/types/frontend/payment.types.ts

/**
 * Frontend payment object (camelCase)
 * Used throughout React components
 */
export interface Payment {
  id: string;
  reservationId: string;
  userId: string;
  shopId: string;
  amount: number;
  currency: string;
  paymentMethod: 'toss_payments' | 'kakao_pay' | 'naver_pay' | 'card' | 'bank_transfer';
  paymentStatus: 'pending' | 'deposit_paid' | 'fully_paid' | 'partially_paid' | 'failed' | 'refunded';
  paymentStage: 'deposit' | 'final';
  isDeposit: boolean;
  paidAt: string | null;
  refundedAt: string | null;
  refundAmount: number;
  failureReason: string | null;
  metadata: Record<string, any> | null;
  version: number;
  reminderSentAt: string | null;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Frontend payment with relationships
 */
export interface PaymentWithRelations extends Payment {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
  };
  shop: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
  reservation: {
    id: string;
    reservationDate: string;
    reservationTime: string;
    status: string;
    totalAmount: number;
  };
}

/**
 * Frontend point transaction
 */
export interface PointTransaction {
  id: string;
  userId: string;
  transactionType: 'earned_service' | 'earned_referral' | 'influencer_bonus' | 'used_service' | 'adjusted';
  amount: number;
  balanceAfter: number;
  description: string;
  status: 'completed' | 'pending' | 'cancelled' | 'expired';
  reservationId: string | null;
  paymentId: string | null;
  expiresAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Frontend refund
 */
export interface Refund {
  id: string;
  paymentId: string;
  reservationId: string;
  userId: string;
  refundType: 'full' | 'partial';
  refundReason: 'cancelled_by_customer' | 'service_issue' | 'shop_cancelled' | 'no_show' | 'double_booking' | 'other';
  refundReasonDetails: string | null;
  requestedAmount: number;
  approvedAmount: number | null;
  refundedAmount: number | null;
  refundStatus: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  refundMethod: 'original' | 'bank_transfer' | 'point_return';
  adminNotes: string | null;
  customerNotes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  processedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Frontend pagination
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
}

/**
 * Frontend paginated list
 */
export interface PaginatedList<T> {
  items: T[];
  pagination: Pagination;
}
```

### Transformation Utilities

```typescript
// src/utils/transformers/payment.transformers.ts

import type {
  BackendPayment,
  BackendPaymentWithRelations,
  BackendPointTransaction,
  BackendRefund,
  BackendPagination
} from '@/types/backend/payment.types';
import type {
  Payment,
  PaymentWithRelations,
  PointTransaction,
  Refund,
  Pagination
} from '@/types/frontend/payment.types';

/**
 * Transform backend payment to frontend format
 */
export function transformPayment(data: BackendPayment): Payment {
  return {
    id: data.id,
    reservationId: data.reservation_id,
    userId: data.user_id,
    shopId: data.shop_id,
    amount: data.amount,
    currency: data.currency,
    paymentMethod: data.payment_method,
    paymentStatus: data.payment_status,
    paymentStage: data.payment_stage,
    isDeposit: data.is_deposit,
    paidAt: data.paid_at,
    refundedAt: data.refunded_at,
    refundAmount: data.refund_amount,
    failureReason: data.failure_reason,
    metadata: data.metadata,
    version: data.version,
    reminderSentAt: data.reminder_sent_at,
    reminderCount: data.reminder_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Transform backend payment with relations
 */
export function transformPaymentWithRelations(data: BackendPaymentWithRelations): PaymentWithRelations {
  const basePayment = transformPayment(data);

  return {
    ...basePayment,
    customer: {
      id: data.customer.id,
      name: data.customer.name,
      email: data.customer.email,
      phoneNumber: data.customer.phone_number
    },
    shop: {
      id: data.shop.id,
      name: data.shop.name,
      phoneNumber: data.shop.phone_number
    },
    reservation: {
      id: data.reservation.id,
      reservationDate: data.reservation.reservation_date,
      reservationTime: data.reservation.reservation_time,
      status: data.reservation.status,
      totalAmount: data.reservation.total_amount
    }
  };
}

/**
 * Transform backend point transaction
 */
export function transformPointTransaction(data: BackendPointTransaction): PointTransaction {
  return {
    id: data.id,
    userId: data.user_id,
    transactionType: data.transaction_type,
    amount: data.amount,
    balanceAfter: data.balance_after,
    description: data.description,
    status: data.status,
    reservationId: data.reservation_id,
    paymentId: data.payment_id,
    expiresAt: data.expires_at,
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Transform backend refund
 */
export function transformRefund(data: BackendRefund): Refund {
  return {
    id: data.id,
    paymentId: data.payment_id,
    reservationId: data.reservation_id,
    userId: data.user_id,
    refundType: data.refund_type,
    refundReason: data.refund_reason,
    refundReasonDetails: data.refund_reason_details,
    requestedAmount: data.requested_amount,
    approvedAmount: data.approved_amount,
    refundedAmount: data.refunded_amount,
    refundStatus: data.refund_status,
    refundMethod: data.refund_method,
    adminNotes: data.admin_notes,
    customerNotes: data.customer_notes,
    requestedAt: data.requested_at,
    approvedAt: data.approved_at,
    approvedBy: data.approved_by,
    processedAt: data.processed_at,
    completedAt: data.completed_at,
    failedAt: data.failed_at,
    failureReason: data.failure_reason,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Transform backend pagination
 */
export function transformPagination(data: BackendPagination): Pagination {
  return {
    page: data.page,
    limit: data.limit,
    total: data.total,
    totalPages: data.total_pages,
    hasMore: data.has_more
  };
}
```

---

## 🔧 API Service Layer Implementation

### Base API Configuration

```typescript
// src/services/api.ts

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Admin API client (for admin-only endpoints)
 */
export const adminApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * User API client (for user endpoints)
 */
export const userApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Get admin token from storage
 */
function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

/**
 * Get user token from storage
 */
function getUserToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_token');
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Admin API request interceptor
 * Automatically adds Authorization header with admin token
 */
adminApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAdminToken();

    if (!token) {
      // Redirect to admin login
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
      return Promise.reject(new Error('No admin token found'));
    }

    if (isTokenExpired(token)) {
      // Token expired, clear and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
      return Promise.reject(new Error('Admin token expired'));
    }

    // Add Authorization header
    config.headers.Authorization = `Bearer ${token}`;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * User API request interceptor
 */
userApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getUserToken();

    if (token && !isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Admin API response interceptor
 * Unwraps { success: true, data: {...} } to just data
 */
adminApi.interceptors.response.use(
  (response) => {
    // Backend returns: { success: true, data: {...} }
    // We want to unwrap to just the data
    if (response.data && response.data.success && response.data.data !== undefined) {
      return response.data.data; // Unwrap to just data
    }
    return response.data;
  },
  (error) => {
    // Handle 403 specifically
    if (error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    }

    // Handle 401
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    }

    return Promise.reject(error);
  }
);

/**
 * User API response interceptor
 */
userApi.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

### Payment Service

```typescript
// src/services/payment.service.ts

import { adminApi, userApi } from './api';
import {
  transformPayment,
  transformPaymentWithRelations,
  transformPagination
} from '@/utils/transformers/payment.transformers';
import type {
  Payment,
  PaymentWithRelations,
  PaginatedList
} from '@/types/frontend/payment.types';
import type {
  BackendPayment,
  BackendPaymentWithRelations,
  BackendPaginatedResponse
} from '@/types/backend/payment.types';

export class PaymentService {
  /**
   * Get payment details by ID
   */
  static async getPaymentDetails(paymentId: string): Promise<{
    payment: PaymentWithRelations;
  }> {
    // userApi already unwraps response.data.data
    const data = await userApi.get<BackendPaymentWithRelations>(
      `/payments/${paymentId}`
    );

    return {
      payment: transformPaymentWithRelations(data as any)
    };
  }

  /**
   * Get user payment history
   */
  static async getUserPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<PaginatedList<PaymentWithRelations>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    if (status) {
      params.append('status', status);
    }

    const data = await userApi.get<BackendPaginatedResponse<BackendPaymentWithRelations>>(
      `/payments/user/${userId}?${params.toString()}`
    );

    // Data structure from backend: { payments: [...], pagination: {...} }
    const response = data as any;

    return {
      items: response.payments.map(transformPaymentWithRelations),
      pagination: transformPagination(response.pagination)
    };
  }

  /**
   * Prepare deposit payment
   */
  static async prepareDepositPayment(params: {
    reservationId: string;
    depositAmount: number;
    successUrl: string;
    failUrl: string;
  }): Promise<{
    paymentId: string;
    orderId: string;
    checkoutUrl: string;
    paymentKey: string;
    amount: number;
    paymentStage: string;
    isDeposit: boolean;
  }> {
    const data = await userApi.post('/payments/deposit/prepare', {
      reservationId: params.reservationId,
      depositAmount: params.depositAmount,
      successUrl: params.successUrl,
      failUrl: params.failUrl
    });

    const response = data as any;

    return {
      paymentId: response.payment_id,
      orderId: response.order_id,
      checkoutUrl: response.checkout_url,
      paymentKey: response.payment_key,
      amount: response.amount,
      paymentStage: response.payment_stage,
      isDeposit: response.is_deposit
    };
  }

  /**
   * Confirm payment with TossPayments
   */
  static async confirmPayment(params: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }): Promise<{
    paymentId: string;
    status: string;
    transactionId: string;
    approvedAt: string;
    receiptUrl: string;
  }> {
    const data = await userApi.post('/payments/toss/confirm', {
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount
    });

    const response = data as any;

    return {
      paymentId: response.payment_id,
      status: response.status,
      transactionId: response.transaction_id,
      approvedAt: response.approved_at,
      receiptUrl: response.receipt_url
    };
  }

  /**
   * ADMIN: Get all payments with filters
   */
  static async getAdminPayments(filters: {
    page?: number;
    limit?: number;
    status?: string;
    paymentMethod?: string;
    shopId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedList<PaymentWithRelations>> {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.status) params.append('status', filters.status);
    if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
    if (filters.shopId) params.append('shopId', filters.shopId);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const data = await adminApi.get<BackendPaginatedResponse<BackendPaymentWithRelations>>(
      `/admin/payments?${params.toString()}`
    );

    const response = data as any;

    return {
      items: response.payments.map(transformPaymentWithRelations),
      pagination: transformPagination(response.pagination)
    };
  }
}
```

### Point Service

```typescript
// src/services/point.service.ts

import { userApi, adminApi } from './api';
import {
  transformPointTransaction,
  transformPagination
} from '@/utils/transformers/payment.transformers';
import type {
  PointTransaction,
  PaginatedList
} from '@/types/frontend/payment.types';
import type {
  BackendPointTransaction,
  BackendPaginatedResponse
} from '@/types/backend/payment.types';

export class PointService {
  /**
   * Get point balance for user
   */
  static async getPointBalance(userId: string): Promise<{
    userId: string;
    availableBalance: number;
    pendingBalance: number;
    totalEarned: number;
    totalUsed: number;
    totalExpired: number;
    expiringSoon: {
      amount: number;
      expiryDate: string;
    } | null;
    lastTransactionAt: string | null;
  }> {
    const data = await userApi.get(`/users/${userId}/points/balance`);
    const response = data as any;

    return {
      userId: response.user_id,
      availableBalance: response.available_balance,
      pendingBalance: response.pending_balance,
      totalEarned: response.total_earned,
      totalUsed: response.total_used,
      totalExpired: response.total_expired,
      expiringSoon: response.expiring_soon ? {
        amount: response.expiring_soon.amount,
        expiryDate: response.expiring_soon.expiry_date
      } : null,
      lastTransactionAt: response.last_transaction_at
    };
  }

  /**
   * Get point transaction history
   */
  static async getPointHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      transactionType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedList<PointTransaction> & {
    summary: {
      totalEarned: number;
      totalUsed: number;
      netBalance: number;
    };
  }> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    });

    if (filters?.transactionType) params.append('transactionType', filters.transactionType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const data = await userApi.get(
      `/users/${userId}/points/history?${params.toString()}`
    );

    const response = data as any;

    return {
      items: response.transactions.map(transformPointTransaction),
      pagination: transformPagination(response.pagination),
      summary: {
        totalEarned: response.summary.total_earned,
        totalUsed: response.summary.total_used,
        netBalance: response.summary.net_balance
      }
    };
  }

  /**
   * Use points for payment
   */
  static async usePoints(params: {
    amount: number;
    reservationId: string;
    description: string;
  }): Promise<PointTransaction> {
    const data = await userApi.post('/points/use', {
      amount: params.amount,
      reservationId: params.reservationId,
      description: params.description
    });

    return transformPointTransaction(data as any);
  }

  /**
   * ADMIN: Adjust user points
   */
  static async adjustPoints(params: {
    userId: string;
    amount: number;
    type: 'add' | 'subtract';
    reason: string;
  }): Promise<{
    transaction: PointTransaction;
    adjustment: {
      id: string;
      userId: string;
      amount: number;
      type: string;
      reason: string;
      previousBalance: number;
      newBalance: number;
      adjustedBy: string;
      createdAt: string;
    };
  }> {
    const data = await adminApi.post('/admin/points/adjust', {
      userId: params.userId,
      amount: params.amount,
      type: params.type,
      reason: params.reason
    });

    const response = data as any;

    return {
      transaction: transformPointTransaction(response.transaction),
      adjustment: {
        id: response.adjustment.id,
        userId: response.adjustment.user_id,
        amount: response.adjustment.amount,
        type: response.adjustment.type,
        reason: response.adjustment.reason,
        previousBalance: response.adjustment.previous_balance,
        newBalance: response.adjustment.new_balance,
        adjustedBy: response.adjustment.adjusted_by,
        createdAt: response.adjustment.created_at
      }
    };
  }
}
```

### Refund Service

```typescript
// src/services/refund.service.ts

import { userApi, adminApi } from './api';
import {
  transformRefund,
  transformPagination
} from '@/utils/transformers/payment.transformers';
import type {
  Refund,
  PaginatedList
} from '@/types/frontend/payment.types';
import type {
  BackendRefund,
  BackendPaginatedResponse
} from '@/types/backend/payment.types';

export class RefundService {
  /**
   * Create refund request
   */
  static async createRefundRequest(params: {
    paymentId: string;
    refundType: 'full' | 'partial';
    refundReason: string;
    refundReasonDetails?: string;
    customerNotes?: string;
    refundMethod: 'original' | 'bank_transfer' | 'point_return';
  }): Promise<{
    refundId: string;
    status: string;
    requestedAmount: number;
    refundMethod: string;
    message: string;
  }> {
    const data = await userApi.post('/refunds/request', {
      paymentId: params.paymentId,
      refundType: params.refundType,
      refundReason: params.refundReason,
      refundReasonDetails: params.refundReasonDetails,
      customerNotes: params.customerNotes,
      refundMethod: params.refundMethod
    });

    const response = data as any;

    return {
      refundId: response.refund_id,
      status: response.status,
      requestedAmount: response.requested_amount,
      refundMethod: response.refund_method,
      message: response.message
    };
  }

  /**
   * Get refund status
   */
  static async getRefundStatus(refundId: string): Promise<Refund & {
    isEligibleForRefund: boolean;
    refundPolicy: {
      policyId: string;
      policyName: string;
      refundPercentage: number;
      cancellationWindow: string;
      penalties: string;
    };
  }> {
    const data = await userApi.get(`/refunds/${refundId}/status`);
    const response = data as any;

    return {
      ...transformRefund(response),
      isEligibleForRefund: response.is_eligible_for_refund,
      refundPolicy: {
        policyId: response.refund_policy.policy_id,
        policyName: response.refund_policy.policy_name,
        refundPercentage: response.refund_policy.refund_percentage,
        cancellationWindow: response.refund_policy.cancellation_window,
        penalties: response.refund_policy.penalties
      }
    };
  }

  /**
   * Calculate refund amount
   */
  static async calculateRefundAmount(params: {
    reservationId: string;
    cancellationType: string;
    cancellationReason: string;
    refundPreference: string;
  }): Promise<{
    isEligible: boolean;
    refundAmount: number;
    refundPercentage: number;
    basePercentage: number;
    adjustmentPercentage: number;
    cancellationWindow: string;
    reason: string;
    policyApplied: string;
    koreanTimeInfo: {
      currentTime: string;
      reservationTime: string;
      timeZone: string;
    };
    businessRules: {
      appliedPolicies: string[];
      exceptions: string[];
      notes: string[];
    };
  }> {
    const data = await userApi.post('/refunds/calculate', {
      reservationId: params.reservationId,
      cancellationType: params.cancellationType,
      cancellationReason: params.cancellationReason,
      refundPreference: params.refundPreference
    });

    const response = data as any;

    return {
      isEligible: response.is_eligible,
      refundAmount: response.refund_amount,
      refundPercentage: response.refund_percentage,
      basePercentage: response.base_percentage,
      adjustmentPercentage: response.adjustment_percentage,
      cancellationWindow: response.cancellation_window,
      reason: response.reason,
      policyApplied: response.policy_applied,
      koreanTimeInfo: {
        currentTime: response.korean_time_info.current_time,
        reservationTime: response.korean_time_info.reservation_time,
        timeZone: response.korean_time_info.time_zone
      },
      businessRules: {
        appliedPolicies: response.business_rules.applied_policies,
        exceptions: response.business_rules.exceptions,
        notes: response.business_rules.notes
      }
    };
  }

  /**
   * ADMIN: Get all refunds
   */
  static async getAdminRefunds(filters: {
    page?: number;
    limit?: number;
    status?: string;
    refundType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedList<Refund>> {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.status) params.append('status', filters.status);
    if (filters.refundType) params.append('refundType', filters.refundType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    // ❌ This is what's causing your 403 error
    // The endpoint might be wrong or doesn't exist
    try {
      const data = await adminApi.get(
        `/admin/financial/refunds?${params.toString()}`
      );

      const response = data as any;

      return {
        items: response.refunds ? response.refunds.map(transformRefund) : [],
        pagination: response.pagination ? transformPagination(response.pagination) : {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      };
    } catch (error: any) {
      // Handle 403 specifically
      if (error.response?.status === 403) {
        throw new Error('관리자 권한이 필요합니다. 다시 로그인해 주세요.');
      }

      // Handle 404 (endpoint doesn't exist)
      if (error.response?.status === 404) {
        throw new Error('환불 API 엔드포인트를 찾을 수 없습니다.');
      }

      throw error;
    }
  }

  /**
   * ADMIN: Process refund
   */
  static async processRefund(
    paymentId: string,
    params: {
      refundAmount: number;
      reason: string;
      refundMethod: 'original' | 'bank_transfer' | 'point_return';
      notes?: string;
      notifyCustomer?: boolean;
    }
  ): Promise<{
    refundId: string;
    paymentId: string;
    refundAmount: number;
    refundStatus: string;
    refundMethod: string;
    estimatedCompletion: string;
    adminNotes: string | null;
    processedAt: string;
  }> {
    const data = await adminApi.post(`/admin/payments/${paymentId}/refund`, {
      refundAmount: params.refundAmount,
      reason: params.reason,
      refundMethod: params.refundMethod,
      notes: params.notes,
      notifyCustomer: params.notifyCustomer
    });

    const response = data as any;

    return {
      refundId: response.refund_id,
      paymentId: response.payment_id,
      refundAmount: response.refund_amount,
      refundStatus: response.refund_status,
      refundMethod: response.refund_method,
      estimatedCompletion: response.estimated_completion,
      adminNotes: response.admin_notes,
      processedAt: response.processed_at
    };
  }
}
```

---

## 🪝 React Query Hooks

```typescript
// src/hooks/usePayments.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentService } from '@/services/payment.service';
import { message } from 'antd';

/**
 * Get payment details
 */
export function usePaymentDetails(paymentId: string | null) {
  return useQuery({
    queryKey: ['payment', 'details', paymentId],
    queryFn: () => PaymentService.getPaymentDetails(paymentId!),
    enabled: !!paymentId,
    staleTime: 30000
  });
}

/**
 * Get user payment history
 */
export function useUserPaymentHistory(
  userId: string | null,
  page: number = 1,
  limit: number = 20,
  status?: string
) {
  return useQuery({
    queryKey: ['payments', 'user', userId, page, limit, status],
    queryFn: () => PaymentService.getUserPaymentHistory(userId!, page, limit, status),
    enabled: !!userId,
    staleTime: 30000
  });
}

/**
 * Prepare deposit payment
 */
export function usePrepareDepositPayment() {
  return useMutation({
    mutationFn: (params: {
      reservationId: string;
      depositAmount: number;
      successUrl: string;
      failUrl: string;
    }) => PaymentService.prepareDepositPayment(params),
    onSuccess: (data) => {
      // Redirect to TossPayments checkout
      if (typeof window !== 'undefined') {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '결제 준비 중 오류가 발생했습니다.');
    }
  });
}

/**
 * Confirm payment
 */
export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      paymentKey: string;
      orderId: string;
      amount: number;
    }) => PaymentService.confirmPayment(params),
    onSuccess: () => {
      message.success('결제가 완료되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '결제 확인 중 오류가 발생했습니다.');
    }
  });
}

/**
 * ADMIN: Get all payments
 */
export function useAdminPayments(filters: {
  page?: number;
  limit?: number;
  status?: string;
  paymentMethod?: string;
  shopId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'payments', filters],
    queryFn: () => PaymentService.getAdminPayments(filters),
    staleTime: 30000,
    retry: 1, // Only retry once on failure
    onError: (error: any) => {
      if (error.response?.status === 403) {
        message.error('관리자 권한이 필요합니다.');
      }
    }
  });
}
```

```typescript
// src/hooks/usePoints.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PointService } from '@/services/point.service';
import { message } from 'antd';

/**
 * Get point balance
 */
export function usePointBalance(userId: string | null) {
  return useQuery({
    queryKey: ['points', 'balance', userId],
    queryFn: () => PointService.getPointBalance(userId!),
    enabled: !!userId,
    staleTime: 30000
  });
}

/**
 * Get point history
 */
export function usePointHistory(
  userId: string | null,
  page: number = 1,
  limit: number = 20,
  filters?: {
    transactionType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  return useQuery({
    queryKey: ['points', 'history', userId, page, limit, filters],
    queryFn: () => PointService.getPointHistory(userId!, page, limit, filters),
    enabled: !!userId,
    staleTime: 30000
  });
}

/**
 * Use points
 */
export function useUsePoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      amount: number;
      reservationId: string;
      description: string;
    }) => PointService.usePoints(params),
    onSuccess: () => {
      message.success('포인트가 사용되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['points'] });
    },
    onError: (error: any) => {
      const errorCode = error.response?.data?.error?.code;

      if (errorCode === 'INSUFFICIENT_POINTS') {
        message.error('사용 가능한 포인트가 부족합니다.');
      } else {
        message.error('포인트 사용 중 오류가 발생했습니다.');
      }
    }
  });
}
```

```typescript
// src/hooks/useRefunds.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefundService } from '@/services/refund.service';
import { message } from 'antd';

/**
 * Create refund request
 */
export function useCreateRefundRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      paymentId: string;
      refundType: 'full' | 'partial';
      refundReason: string;
      refundReasonDetails?: string;
      customerNotes?: string;
      refundMethod: 'original' | 'bank_transfer' | 'point_return';
    }) => RefundService.createRefundRequest(params),
    onSuccess: () => {
      message.success('환불 요청이 접수되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '환불 요청 중 오류가 발생했습니다.');
    }
  });
}

/**
 * Get refund status
 */
export function useRefundStatus(refundId: string | null) {
  return useQuery({
    queryKey: ['refund', 'status', refundId],
    queryFn: () => RefundService.getRefundStatus(refundId!),
    enabled: !!refundId,
    staleTime: 30000
  });
}

/**
 * Calculate refund amount
 */
export function useCalculateRefund() {
  return useMutation({
    mutationFn: (params: {
      reservationId: string;
      cancellationType: string;
      cancellationReason: string;
      refundPreference: string;
    }) => RefundService.calculateRefundAmount(params)
  });
}

/**
 * ADMIN: Get all refunds
 */
export function useAdminRefunds(filters: {
  page?: number;
  limit?: number;
  status?: string;
  refundType?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'refunds', filters],
    queryFn: () => RefundService.getAdminRefunds(filters),
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      if (error.response?.status === 403) {
        message.error('관리자 권한이 필요합니다.');
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login';
        }
      } else if (error.response?.status === 404) {
        message.error('환불 API를 찾을 수 없습니다.');
      }
    }
  });
}

/**
 * ADMIN: Process refund
 */
export function useProcessRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      params
    }: {
      paymentId: string;
      params: {
        refundAmount: number;
        reason: string;
        refundMethod: 'original' | 'bank_transfer' | 'point_return';
        notes?: string;
        notifyCustomer?: boolean;
      };
    }) => RefundService.processRefund(paymentId, params),
    onSuccess: () => {
      message.success('환불이 처리되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
    },
    onError: (error: any) => {
      if (error.response?.status === 403) {
        message.error('관리자 권한이 필요합니다.');
      } else {
        message.error(error.response?.data?.message || '환불 처리 중 오류가 발생했습니다.');
      }
    }
  });
}
```

---

*This is part 1 of the ultra-detailed guide. Continue to part 2?*
