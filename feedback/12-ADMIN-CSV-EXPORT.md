# Implementation Plan: Admin CSV Export

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 8-12 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Admin Panel |
| **Dependencies** | None |

## Problem Statement

CSV export functionality is marked as TODO throughout the admin panel:

```typescript
// Admin: CSV export buttons exist but are non-functional
// No backend endpoints for generating CSV exports
// Users cannot export data for external analysis
```

**Current State:**
- Export buttons exist in admin UI but are disabled/non-functional
- No backend API for generating CSV files
- Data tables show data but cannot be exported

**Impact:**
1. Admins cannot export data for reporting
2. No offline data analysis capability
3. Cannot share data with stakeholders
4. Missing standard admin feature

---

## Data Export Requirements

### Exportable Data Types

| Entity | Fields | Filters |
|--------|--------|---------|
| **Users** | id, email, nickname, phone, role, status, created_at, last_login_at | role, status, date_range |
| **Shops** | id, name, category, address, phone, status, rating, created_at | category, status, date_range |
| **Reservations** | id, user_email, shop_name, service_name, date, time, status, amount | shop_id, status, date_range |
| **Payments** | id, reservation_id, user_email, amount, status, method, created_at | status, method, date_range |
| **Points** | user_email, transaction_type, amount, balance, created_at | transaction_type, date_range |
| **Reviews** | id, user_email, shop_name, rating, content, status, created_at | shop_id, rating, status, date_range |

### Export Limits

| Type | Maximum Rows | Estimated File Size |
|------|--------------|---------------------|
| Standard | 10,000 | ~2MB |
| Large | 50,000 | ~10MB |
| Full (Admin only) | 100,000 | ~20MB |

---

## Backend Implementation

### Step 1: Create CSV Export Types

**File:** `src/types/export.types.ts`

```typescript
/**
 * CSV Export Type Definitions
 */

// Export entity types
export type ExportEntity =
  | 'users'
  | 'shops'
  | 'reservations'
  | 'payments'
  | 'points'
  | 'reviews'
  | 'audit_logs';

// Export status
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

// Date range filter
export interface DateRangeFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

// Base export request
export interface ExportRequest {
  entity: ExportEntity;
  filters?: Record<string, any>;
  dateRange?: DateRangeFilter;
  columns?: string[]; // Optional column selection
  format?: 'csv' | 'xlsx'; // Default: csv
  includeHeaders?: boolean; // Default: true
}

// Export job record
export interface ExportJob {
  id: string;
  userId: string;
  entity: ExportEntity;
  filters: Record<string, any>;
  status: ExportStatus;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  rowCount: number | null;
  error: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Export result
export interface ExportResult {
  success: boolean;
  jobId: string;
  status: ExportStatus;
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}

// Column definition for CSV export
export interface ColumnDefinition {
  key: string;
  header: string;
  headerKorean: string;
  formatter?: (value: any) => string;
}
```

### Step 2: Create Export Service

**File:** `src/services/export.service.ts`

```typescript
/**
 * CSV Export Service
 * Handles data export to CSV/XLSX formats
 */

import { supabase } from '@/config/supabase';
import { v4 as uuidv4 } from 'uuid';
import {
  ExportEntity,
  ExportRequest,
  ExportJob,
  ExportResult,
  ColumnDefinition,
  DateRangeFilter,
} from '@/types/export.types';

// Column definitions for each entity
const COLUMN_DEFINITIONS: Record<ExportEntity, ColumnDefinition[]> = {
  users: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'email', header: 'Email', headerKorean: '이메일' },
    { key: 'nickname', header: 'Nickname', headerKorean: '닉네임' },
    { key: 'phone', header: 'Phone', headerKorean: '전화번호' },
    { key: 'role', header: 'Role', headerKorean: '역할' },
    { key: 'status', header: 'Status', headerKorean: '상태' },
    { key: 'created_at', header: 'Created At', headerKorean: '가입일', formatter: formatDateTime },
    { key: 'last_login_at', header: 'Last Login', headerKorean: '마지막 로그인', formatter: formatDateTime },
  ],
  shops: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'name', header: 'Name', headerKorean: '상호명' },
    { key: 'category', header: 'Category', headerKorean: '카테고리' },
    { key: 'address', header: 'Address', headerKorean: '주소' },
    { key: 'phone', header: 'Phone', headerKorean: '전화번호' },
    { key: 'status', header: 'Status', headerKorean: '상태' },
    { key: 'average_rating', header: 'Rating', headerKorean: '평점' },
    { key: 'review_count', header: 'Reviews', headerKorean: '리뷰 수' },
    { key: 'created_at', header: 'Created At', headerKorean: '등록일', formatter: formatDateTime },
  ],
  reservations: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'user_email', header: 'User Email', headerKorean: '고객 이메일' },
    { key: 'user_phone', header: 'User Phone', headerKorean: '고객 전화번호' },
    { key: 'shop_name', header: 'Shop', headerKorean: '샵명' },
    { key: 'service_name', header: 'Service', headerKorean: '서비스' },
    { key: 'reservation_date', header: 'Date', headerKorean: '예약일' },
    { key: 'start_time', header: 'Time', headerKorean: '시간' },
    { key: 'status', header: 'Status', headerKorean: '상태' },
    { key: 'total_amount', header: 'Amount', headerKorean: '금액', formatter: formatCurrency },
    { key: 'created_at', header: 'Created At', headerKorean: '생성일', formatter: formatDateTime },
  ],
  payments: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'reservation_id', header: 'Reservation ID', headerKorean: '예약 ID' },
    { key: 'user_email', header: 'User Email', headerKorean: '고객 이메일' },
    { key: 'amount', header: 'Amount', headerKorean: '금액', formatter: formatCurrency },
    { key: 'status', header: 'Status', headerKorean: '상태' },
    { key: 'payment_method', header: 'Method', headerKorean: '결제수단' },
    { key: 'pg_provider', header: 'PG Provider', headerKorean: 'PG사' },
    { key: 'created_at', header: 'Created At', headerKorean: '결제일', formatter: formatDateTime },
  ],
  points: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'user_email', header: 'User Email', headerKorean: '고객 이메일' },
    { key: 'transaction_type', header: 'Type', headerKorean: '거래 유형' },
    { key: 'amount', header: 'Amount', headerKorean: '금액' },
    { key: 'balance_after', header: 'Balance After', headerKorean: '잔액' },
    { key: 'description', header: 'Description', headerKorean: '설명' },
    { key: 'created_at', header: 'Created At', headerKorean: '거래일', formatter: formatDateTime },
  ],
  reviews: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'user_email', header: 'User Email', headerKorean: '작성자 이메일' },
    { key: 'shop_name', header: 'Shop', headerKorean: '샵명' },
    { key: 'rating', header: 'Rating', headerKorean: '평점' },
    { key: 'content', header: 'Content', headerKorean: '내용' },
    { key: 'status', header: 'Status', headerKorean: '상태' },
    { key: 'created_at', header: 'Created At', headerKorean: '작성일', formatter: formatDateTime },
  ],
  audit_logs: [
    { key: 'id', header: 'ID', headerKorean: 'ID' },
    { key: 'user_email', header: 'User Email', headerKorean: '사용자 이메일' },
    { key: 'action', header: 'Action', headerKorean: '작업' },
    { key: 'entity_type', header: 'Entity Type', headerKorean: '대상 유형' },
    { key: 'entity_id', header: 'Entity ID', headerKorean: '대상 ID' },
    { key: 'ip_address', header: 'IP Address', headerKorean: 'IP 주소' },
    { key: 'created_at', header: 'Created At', headerKorean: '시간', formatter: formatDateTime },
  ],
};

// Format helpers
function formatDateTime(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '';
  return `${value.toLocaleString('ko-KR')}원`;
}

export class ExportService {
  private readonly EXPORT_LIMIT = 100000;
  private readonly EXPIRY_HOURS = 24;

  /**
   * Create an export job
   */
  async createExportJob(userId: string, request: ExportRequest): Promise<ExportResult> {
    const jobId = uuidv4();

    // Create job record
    const { error: insertError } = await supabase.from('export_jobs').insert({
      id: jobId,
      user_id: userId,
      entity: request.entity,
      filters: request.filters || {},
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      throw new Error(`Failed to create export job: ${insertError.message}`);
    }

    // Process job asynchronously
    this.processExportJob(jobId, request).catch((error) => {
      console.error(`Export job ${jobId} failed:`, error);
    });

    return {
      success: true,
      jobId,
      status: 'pending',
    };
  }

  /**
   * Get export job status
   */
  async getExportJob(jobId: string, userId: string): Promise<ExportJob | null> {
    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      entity: data.entity,
      filters: data.filters,
      status: data.status,
      fileName: data.file_name,
      fileUrl: data.file_url,
      fileSize: data.file_size,
      rowCount: data.row_count,
      error: data.error,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    };
  }

  /**
   * List user's export jobs
   */
  async listExportJobs(userId: string, limit = 20): Promise<ExportJob[]> {
    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list export jobs: ${error.message}`);
    }

    return (data || []).map((d) => ({
      id: d.id,
      userId: d.user_id,
      entity: d.entity,
      filters: d.filters,
      status: d.status,
      fileName: d.file_name,
      fileUrl: d.file_url,
      fileSize: d.file_size,
      rowCount: d.row_count,
      error: d.error,
      expiresAt: d.expires_at,
      createdAt: d.created_at,
      completedAt: d.completed_at,
    }));
  }

  /**
   * Process export job (async)
   */
  private async processExportJob(jobId: string, request: ExportRequest): Promise<void> {
    try {
      // Update status to processing
      await this.updateJobStatus(jobId, 'processing');

      // Fetch data
      const data = await this.fetchExportData(request);

      // Generate CSV
      const csv = this.generateCSV(request.entity, data, request.columns);

      // Upload to storage
      const fileName = `exports/${jobId}/${request.entity}_${Date.now()}.csv`;
      const { error: uploadError } = await supabase.storage
        .from('admin-exports')
        .upload(fileName, csv, {
          contentType: 'text/csv',
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(`Failed to upload CSV: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('admin-exports').getPublicUrl(fileName);

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.EXPIRY_HOURS);

      // Update job as completed
      await supabase
        .from('export_jobs')
        .update({
          status: 'completed',
          file_name: fileName,
          file_url: urlData.publicUrl,
          file_size: csv.length,
          row_count: data.length,
          expires_at: expiresAt.toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (error) {
      // Update job as failed
      await supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      throw error;
    }
  }

  /**
   * Fetch data for export
   */
  private async fetchExportData(request: ExportRequest): Promise<any[]> {
    const { entity, filters, dateRange } = request;

    let query: any;

    switch (entity) {
      case 'users':
        query = supabase
          .from('users')
          .select('id, email, nickname, phone, role, status, created_at, last_login_at');
        break;

      case 'shops':
        query = supabase
          .from('shops')
          .select('id, name, category, address, phone, status, average_rating, review_count, created_at');
        break;

      case 'reservations':
        query = supabase
          .from('reservations')
          .select(`
            id,
            user:users(email, phone),
            shop:shops(name),
            service:shop_services(name),
            reservation_date,
            start_time,
            status,
            total_amount,
            created_at
          `);
        break;

      case 'payments':
        query = supabase
          .from('payments')
          .select(`
            id,
            reservation_id,
            user:users(email),
            amount,
            status,
            payment_method,
            pg_provider,
            created_at
          `);
        break;

      case 'points':
        query = supabase
          .from('point_transactions')
          .select(`
            id,
            user:users(email),
            transaction_type,
            amount,
            balance_after,
            description,
            created_at
          `);
        break;

      case 'reviews':
        query = supabase
          .from('reviews')
          .select(`
            id,
            user:users(email),
            shop:shops(name),
            rating,
            content,
            status,
            created_at
          `);
        break;

      case 'audit_logs':
        query = supabase
          .from('audit_logs')
          .select(`
            id,
            user:users(email),
            action,
            entity_type,
            entity_id,
            ip_address,
            created_at
          `);
        break;

      default:
        throw new Error(`Unknown export entity: ${entity}`);
    }

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });
    }

    // Apply date range
    if (dateRange) {
      query = query
        .gte('created_at', `${dateRange.startDate}T00:00:00Z`)
        .lte('created_at', `${dateRange.endDate}T23:59:59Z`);
    }

    // Order and limit
    query = query.order('created_at', { ascending: false }).limit(this.EXPORT_LIMIT);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch data: ${error.message}`);
    }

    // Flatten nested data
    return this.flattenData(entity, data || []);
  }

  /**
   * Flatten nested data from joins
   */
  private flattenData(entity: ExportEntity, data: any[]): any[] {
    return data.map((row) => {
      const flat: Record<string, any> = {};

      Object.entries(row).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Flatten nested object
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            flat[`${key}_${nestedKey}`] = nestedValue;
          });
        } else {
          flat[key] = value;
        }
      });

      return flat;
    });
  }

  /**
   * Generate CSV string
   */
  private generateCSV(entity: ExportEntity, data: any[], selectedColumns?: string[]): string {
    const columns = COLUMN_DEFINITIONS[entity];

    // Filter columns if selection provided
    const activeColumns = selectedColumns
      ? columns.filter((c) => selectedColumns.includes(c.key))
      : columns;

    // Generate header row
    const headerRow = activeColumns.map((c) => this.escapeCSV(c.headerKorean)).join(',');

    // Generate data rows
    const dataRows = data.map((row) => {
      return activeColumns
        .map((col) => {
          let value = row[col.key];

          // Apply formatter if exists
          if (col.formatter && value !== null && value !== undefined) {
            value = col.formatter(value);
          }

          return this.escapeCSV(value);
        })
        .join(',');
    });

    // Add BOM for Excel compatibility with Korean characters
    const BOM = '\uFEFF';
    return BOM + [headerRow, ...dataRows].join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);

    // Escape quotes and wrap in quotes if contains special characters
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string): Promise<void> {
    await supabase.from('export_jobs').update({ status }).eq('id', jobId);
  }

  /**
   * Cleanup expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const now = new Date().toISOString();

    // Get expired jobs
    const { data: expiredJobs } = await supabase
      .from('export_jobs')
      .select('id, file_name')
      .eq('status', 'completed')
      .lt('expires_at', now);

    if (!expiredJobs || expiredJobs.length === 0) return 0;

    // Delete files from storage
    const fileNames = expiredJobs.filter((j) => j.file_name).map((j) => j.file_name!);

    if (fileNames.length > 0) {
      await supabase.storage.from('admin-exports').remove(fileNames);
    }

    // Update jobs as expired
    const jobIds = expiredJobs.map((j) => j.id);
    await supabase.from('export_jobs').update({ status: 'expired' }).in('id', jobIds);

    return expiredJobs.length;
  }
}

export const exportService = new ExportService();
```

### Step 3: Create Export API Routes

**File:** `src/routes/admin/export.routes.ts`

```typescript
/**
 * Admin Export Routes
 */

import { Router } from 'express';
import { exportService } from '@/services/export.service';
import { asyncHandler } from '@/middleware/async.middleware';
import { authenticate, requireAdmin } from '@/middleware/auth.middleware';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

/**
 * POST /api/admin/export
 * Create new export job
 */
router.post(
  '/',
  [
    body('entity')
      .isIn(['users', 'shops', 'reservations', 'payments', 'points', 'reviews', 'audit_logs'])
      .withMessage('Invalid export entity'),
    body('filters').optional().isObject(),
    body('dateRange').optional().isObject(),
    body('dateRange.startDate').optional().isISO8601(),
    body('dateRange.endDate').optional().isISO8601(),
    body('columns').optional().isArray(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', details: errors.array() },
      });
    }

    const result = await exportService.createExportJob(req.user!.id, req.body);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/admin/export/:jobId
 * Get export job status
 */
router.get(
  '/:jobId',
  [param('jobId').isUUID()],
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const job = await exportService.getExportJob(jobId, req.user!.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Export job not found' },
      });
    }

    res.json({
      success: true,
      data: job,
    });
  })
);

/**
 * GET /api/admin/export
 * List user's export jobs
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const jobs = await exportService.listExportJobs(req.user!.id);

    res.json({
      success: true,
      data: jobs,
    });
  })
);

export default router;
```

### Step 4: Create Database Migration

**File:** `src/migrations/XXX_create_export_jobs_table.sql`

```sql
-- Migration: Create export jobs table
-- Tracks CSV export requests and their status

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Export configuration
  entity VARCHAR(50) NOT NULL,
  filters JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error TEXT,

  -- Result
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  row_count INTEGER,

  -- Timestamps
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at DESC);

-- RLS
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export jobs"
  ON export_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own export jobs"
  ON export_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Storage bucket for exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-exports', 'admin-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy - only authenticated admins
CREATE POLICY "Admins can access exports"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'admin-exports' AND
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );
```

---

## Admin Panel Implementation

### Step 5: Create Export Context/Hook

**File:** `src/hooks/use-export.ts`

```typescript
/**
 * useExport Hook
 * Manages CSV export functionality in admin panel
 */

'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ExportEntity, ExportJob, ExportRequest, DateRangeFilter } from '@/types/export.types';

interface UseExportOptions {
  onSuccess?: (job: ExportJob) => void;
  onError?: (error: Error) => void;
}

export function useExport(options: UseExportOptions = {}) {
  const { onSuccess, onError } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  // Create export mutation
  const createExportMutation = useMutation({
    mutationFn: async (request: ExportRequest) => {
      const response = await api.post('/admin/export', request);
      return response.data.data;
    },
    onSuccess: (data) => {
      toast({
        title: '내보내기 시작',
        description: '데이터 내보내기가 시작되었습니다. 완료되면 알려드리겠습니다.',
      });

      // Start polling for completion
      setPollingJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: ['export-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: '내보내기 실패',
        description: error.message || '데이터 내보내기에 실패했습니다.',
        variant: 'destructive',
      });
      onError?.(error);
    },
  });

  // Get job status query (with polling)
  const { data: pollingJob } = useQuery({
    queryKey: ['export-job', pollingJobId],
    queryFn: async () => {
      const response = await api.get(`/admin/export/${pollingJobId}`);
      return response.data.data as ExportJob;
    },
    enabled: !!pollingJobId,
    refetchInterval: (query) => {
      const data = query.state.data as ExportJob | undefined;
      // Stop polling when completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    refetchOnWindowFocus: false,
  });

  // Handle polling job completion
  useEffect(() => {
    if (pollingJob?.status === 'completed') {
      toast({
        title: '내보내기 완료',
        description: '데이터 내보내기가 완료되었습니다.',
        action: pollingJob.fileUrl ? (
          <a href={pollingJob.fileUrl} download className="text-primary underline">
            다운로드
          </a>
        ) : undefined,
      });
      setPollingJobId(null);
      onSuccess?.(pollingJob);
      queryClient.invalidateQueries({ queryKey: ['export-jobs'] });
    } else if (pollingJob?.status === 'failed') {
      toast({
        title: '내보내기 실패',
        description: pollingJob.error || '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
      setPollingJobId(null);
    }
  }, [pollingJob?.status]);

  // List export jobs
  const { data: exportJobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['export-jobs'],
    queryFn: async () => {
      const response = await api.get('/admin/export');
      return response.data.data as ExportJob[];
    },
  });

  // Export function
  const exportData = useCallback(
    (entity: ExportEntity, filters?: Record<string, any>, dateRange?: DateRangeFilter) => {
      createExportMutation.mutate({
        entity,
        filters,
        dateRange,
      });
    },
    [createExportMutation]
  );

  return {
    exportData,
    isExporting: createExportMutation.isPending || !!pollingJobId,
    pollingJob,
    exportJobs,
    isLoadingJobs,
  };
}

// Add missing import
import { useEffect } from 'react';

export default useExport;
```

### Step 6: Create ExportButton Component

**File:** `src/components/export/ExportButton.tsx`

```tsx
/**
 * ExportButton Component
 * Button to trigger CSV export with options
 */

'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useExport } from '@/hooks/use-export';
import type { ExportEntity, DateRangeFilter } from '@/types/export.types';
import { DateRange } from 'react-day-picker';

interface ExportButtonProps {
  entity: ExportEntity;
  filters?: Record<string, any>;
  label?: string;
  disabled?: boolean;
}

const entityLabels: Record<ExportEntity, string> = {
  users: '사용자',
  shops: '샵',
  reservations: '예약',
  payments: '결제',
  points: '포인트',
  reviews: '리뷰',
  audit_logs: '감사 로그',
};

export function ExportButton({
  entity,
  filters,
  label = '내보내기',
  disabled = false,
}: ExportButtonProps) {
  const { exportData, isExporting } = useExport();
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleQuickExport = () => {
    exportData(entity, filters);
  };

  const handleExportWithDates = () => {
    if (!dateRange?.from || !dateRange?.to) return;

    const range: DateRangeFilter = {
      startDate: dateRange.from.toISOString().split('T')[0],
      endDate: dateRange.to.toISOString().split('T')[0],
    };

    exportData(entity, filters, range);
    setShowDateDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <FileSpreadsheet className="h-4 w-4 mr-2 inline" />
            {entityLabels[entity]} 내보내기
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleQuickExport}>
            전체 내보내기
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDateDialog(true)}>
            기간 선택 내보내기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date range dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>내보내기 기간 선택</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleExportWithDates}
              disabled={!dateRange?.from || !dateRange?.to}
            >
              내보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ExportButton;
```

### Step 7: Create ExportHistory Component

**File:** `src/components/export/ExportHistory.tsx`

```tsx
/**
 * ExportHistory Component
 * Shows list of recent export jobs
 */

'use client';

import { Download, Clock, CheckCircle, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useExport } from '@/hooks/use-export';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { ExportJob } from '@/types/export.types';

const statusConfig = {
  pending: { label: '대기 중', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  processing: { label: '처리 중', icon: Loader2, color: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  failed: { label: '실패', icon: XCircle, color: 'bg-red-100 text-red-700' },
  expired: { label: '만료됨', icon: Clock, color: 'bg-gray-100 text-gray-500' },
};

const entityLabels: Record<string, string> = {
  users: '사용자',
  shops: '샵',
  reservations: '예약',
  payments: '결제',
  points: '포인트',
  reviews: '리뷰',
  audit_logs: '감사 로그',
};

export function ExportHistory() {
  const { exportJobs, isLoadingJobs } = useExport();

  if (isLoadingJobs) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exportJobs || exportJobs.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>내보내기 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exportJobs.map((job) => (
        <ExportJobItem key={job.id} job={job} />
      ))}
    </div>
  );
}

function ExportJobItem({ job }: { job: ExportJob }) {
  const config = statusConfig[job.status];
  const StatusIcon = config.icon;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">
            {entityLabels[job.entity] || job.entity}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(job.createdAt), {
              addSuffix: true,
              locale: ko,
            })}
            {job.rowCount && ` · ${job.rowCount.toLocaleString()}행`}
            {job.fileSize && ` · ${formatFileSize(job.fileSize)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className={config.color}>
          <StatusIcon
            className={`h-3 w-3 mr-1 ${job.status === 'processing' ? 'animate-spin' : ''}`}
          />
          {config.label}
        </Badge>

        {job.status === 'completed' && job.fileUrl && (
          <Button variant="ghost" size="sm" asChild>
            <a href={job.fileUrl} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export default ExportHistory;
```

### Step 8: Add Export Button to Admin Tables

**File:** `src/components/users/UserTable.tsx` (update)

```tsx
// Add to imports
import { ExportButton } from '@/components/export/ExportButton';

// Add to table header/toolbar
<div className="flex items-center gap-2">
  {/* ... existing toolbar items ... */}

  <ExportButton
    entity="users"
    filters={currentFilters} // Pass current table filters
    label="사용자 내보내기"
  />
</div>
```

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/migrations/XXX_create_export_jobs.sql` | **CREATE** | Database migration |
| `src/types/export.types.ts` | **CREATE** | TypeScript types |
| `src/services/export.service.ts` | **CREATE** | Export service |
| `src/routes/admin/export.routes.ts` | **CREATE** | API routes |
| `src/routes/admin/index.ts` | **MODIFY** | Register export routes |

### Admin Panel

| File | Action | Description |
|------|--------|-------------|
| `src/types/export.types.ts` | **CREATE** | TypeScript types |
| `src/hooks/use-export.ts` | **CREATE** | Export hook |
| `src/components/export/ExportButton.tsx` | **CREATE** | Export button |
| `src/components/export/ExportHistory.tsx` | **CREATE** | Export history list |
| `src/components/users/UserTable.tsx` | **MODIFY** | Add export button |
| `src/components/shop/ShopTable.tsx` | **MODIFY** | Add export button |
| `src/components/reservations/ReservationTable.tsx` | **MODIFY** | Add export button |

---

## Testing Plan

### Manual Testing

- [ ] Export button appears in admin tables
- [ ] Quick export creates job successfully
- [ ] Date range selection works
- [ ] Job status polling updates correctly
- [ ] Download link works for completed exports
- [ ] CSV opens correctly in Excel with Korean characters
- [ ] Failed exports show error message
- [ ] Export history shows all jobs

### Test Scenarios

1. **Small export**: Export < 100 records
2. **Large export**: Export > 10,000 records
3. **Filtered export**: Export with filters applied
4. **Date range export**: Export specific date range
5. **Concurrent exports**: Start multiple exports
6. **Error handling**: Test with invalid filters

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Create storage bucket
- [ ] Deploy backend service
- [ ] Deploy admin panel components
- [ ] Add export buttons to admin tables
- [ ] Test export functionality
- [ ] Set up cleanup cron job for expired exports
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Export success rate | >95% |
| Average export time (10K rows) | <30 seconds |
| User satisfaction | Positive feedback |
| Daily export usage | >5 exports |
