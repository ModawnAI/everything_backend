# Implementation Plan: Audit Log Export

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 4-6 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Admin Panel |
| **Dependencies** | CSV Export (Plan 12) |

## Problem Statement

Audit log export is not implemented:

```typescript
// Admin: Audit logs are viewable but cannot be exported
// No compliance-ready export format
// No filtered export capability
```

**Current State:**
- Audit logs are stored in database
- Viewer component exists in admin panel
- No export functionality
- No retention policy management

**Impact:**
1. Cannot provide audit trails for compliance
2. Manual data extraction required
3. No easy backup of audit data
4. Missing security audit export

---

## Audit Log Requirements

### Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `user_id` | UUID | User who performed action |
| `user_email` | string | User email (denormalized) |
| `action` | string | Action type (create, update, delete, etc.) |
| `entity_type` | string | Type of entity affected |
| `entity_id` | UUID | ID of affected entity |
| `previous_values` | JSON | State before change |
| `new_values` | JSON | State after change |
| `ip_address` | string | Client IP address |
| `user_agent` | string | Client user agent |
| `created_at` | timestamp | When action occurred |

### Export Formats

| Format | Use Case |
|--------|----------|
| **CSV** | Spreadsheet analysis |
| **JSON** | Programmatic processing |
| **PDF** | Compliance reports |

### Filter Options

| Filter | Type | Description |
|--------|------|-------------|
| `dateRange` | Date range | Start and end date |
| `userId` | UUID | Filter by user |
| `action` | string[] | Filter by action types |
| `entityType` | string[] | Filter by entity types |
| `search` | string | Search in details |

---

## Backend Implementation

### Step 1: Create Audit Log Export Types

**File:** `src/types/audit-export.types.ts`

```typescript
/**
 * Audit Log Export Type Definitions
 */

// Export format
export type AuditExportFormat = 'csv' | 'json' | 'pdf';

// Export filter options
export interface AuditExportFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  actions?: string[];
  entityTypes?: string[];
  search?: string;
}

// Export request
export interface AuditExportRequest {
  format: AuditExportFormat;
  filters?: AuditExportFilter;
  includeDetails?: boolean; // Include previous/new values
  maxRecords?: number;
}

// Audit log entry for export
export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// Export result
export interface AuditExportResult {
  success: boolean;
  format: AuditExportFormat;
  recordCount: number;
  fileUrl?: string;
  fileName?: string;
  expiresAt?: string;
}
```

### Step 2: Create Audit Export Service

**File:** `src/services/audit-export.service.ts`

```typescript
/**
 * Audit Log Export Service
 * Exports audit logs in various formats
 */

import { supabase } from '@/config/supabase';
import {
  AuditExportFormat,
  AuditExportRequest,
  AuditExportFilter,
  AuditLogEntry,
  AuditExportResult,
} from '@/types/audit-export.types';
import { generatePDF } from '@/utils/pdf-generator';

const MAX_EXPORT_RECORDS = 100000;
const EXPIRY_HOURS = 24;

export class AuditExportService {
  /**
   * Export audit logs
   */
  async exportAuditLogs(request: AuditExportRequest): Promise<AuditExportResult> {
    const { format, filters, includeDetails, maxRecords } = request;

    // Fetch audit logs
    const logs = await this.fetchAuditLogs(
      filters || {},
      Math.min(maxRecords || MAX_EXPORT_RECORDS, MAX_EXPORT_RECORDS)
    );

    if (logs.length === 0) {
      return {
        success: true,
        format,
        recordCount: 0,
      };
    }

    // Generate export file
    let fileContent: Buffer | string;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'csv':
        fileContent = this.generateCSV(logs, includeDetails || false);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;

      case 'json':
        fileContent = JSON.stringify(logs, null, 2);
        contentType = 'application/json';
        fileExtension = 'json';
        break;

      case 'pdf':
        fileContent = await this.generatePDFReport(logs, filters);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Upload to storage
    const fileName = `audit-logs/audit_${Date.now()}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from('admin-exports')
      .upload(fileName, typeof fileContent === 'string' ? Buffer.from(fileContent) : fileContent, {
        contentType,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Failed to upload export: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('admin-exports').getPublicUrl(fileName);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EXPIRY_HOURS);

    return {
      success: true,
      format,
      recordCount: logs.length,
      fileUrl: urlData.publicUrl,
      fileName,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Fetch audit logs with filters
   */
  private async fetchAuditLogs(
    filters: AuditExportFilter,
    limit: number
  ): Promise<AuditLogEntry[]> {
    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        user_id,
        user:users(email),
        action,
        entity_type,
        entity_id,
        previous_values,
        new_values,
        ip_address,
        user_agent,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (filters.startDate) {
      query = query.gte('created_at', `${filters.startDate}T00:00:00Z`);
    }

    if (filters.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59Z`);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.actions && filters.actions.length > 0) {
      query = query.in('action', filters.actions);
    }

    if (filters.entityTypes && filters.entityTypes.length > 0) {
      query = query.in('entity_type', filters.entityTypes);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return (data || []).map((log) => ({
      id: log.id,
      userId: log.user_id,
      userEmail: log.user?.email || 'Unknown',
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      previousValues: log.previous_values,
      newValues: log.new_values,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at,
    }));
  }

  /**
   * Generate CSV export
   */
  private generateCSV(logs: AuditLogEntry[], includeDetails: boolean): string {
    const BOM = '\uFEFF'; // For Excel Korean support

    // Headers
    const headers = [
      'ID',
      '사용자 이메일',
      '작업',
      '대상 유형',
      '대상 ID',
      'IP 주소',
      '일시',
    ];

    if (includeDetails) {
      headers.push('이전 값', '새 값');
    }

    const rows = logs.map((log) => {
      const row = [
        log.id,
        log.userEmail,
        this.translateAction(log.action),
        this.translateEntityType(log.entityType),
        log.entityId,
        log.ipAddress,
        new Date(log.createdAt).toLocaleString('ko-KR'),
      ];

      if (includeDetails) {
        row.push(
          log.previousValues ? JSON.stringify(log.previousValues) : '',
          log.newValues ? JSON.stringify(log.newValues) : ''
        );
      }

      return row.map((val) => this.escapeCSV(val)).join(',');
    });

    return BOM + [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(
    logs: AuditLogEntry[],
    filters?: AuditExportFilter
  ): Promise<Buffer> {
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>감사 로그 리포트</title>
  <style>
    body { font-family: 'Noto Sans KR', sans-serif; padding: 40px; }
    h1 { text-align: center; margin-bottom: 20px; }
    .summary { margin-bottom: 30px; background: #f5f5f5; padding: 15px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f8f9fa; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 11px; }
  </style>
</head>
<body>
  <h1>감사 로그 리포트</h1>

  <div class="summary">
    <strong>기간:</strong> ${filters?.startDate || '전체'} ~ ${filters?.endDate || '전체'}<br>
    <strong>총 기록:</strong> ${logs.length.toLocaleString()}건<br>
    <strong>생성일:</strong> ${new Date().toLocaleString('ko-KR')}
  </div>

  <table>
    <thead>
      <tr>
        <th>일시</th>
        <th>사용자</th>
        <th>작업</th>
        <th>대상</th>
        <th>IP</th>
      </tr>
    </thead>
    <tbody>
      ${logs.slice(0, 1000).map((log) => `
        <tr>
          <td>${new Date(log.createdAt).toLocaleString('ko-KR')}</td>
          <td>${log.userEmail}</td>
          <td>${this.translateAction(log.action)}</td>
          <td>${this.translateEntityType(log.entityType)}</td>
          <td>${log.ipAddress}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${logs.length > 1000 ? '<p style="text-align:center;color:#999;">... 외 ' + (logs.length - 1000) + '건</p>' : ''}

  <div class="footer">
    eBeautything 감사 로그 리포트 | 기밀 문서
  </div>
</body>
</html>
    `;

    return generatePDF('감사 로그', { html }, 'ko');
  }

  /**
   * Translate action to Korean
   */
  private translateAction(action: string): string {
    const translations: Record<string, string> = {
      create: '생성',
      update: '수정',
      delete: '삭제',
      login: '로그인',
      logout: '로그아웃',
      approve: '승인',
      reject: '거절',
      cancel: '취소',
      confirm: '확정',
      bulk_update_status: '일괄 상태 변경',
      bulk_delete: '일괄 삭제',
      bulk_approve: '일괄 승인',
      export: '내보내기',
    };

    return translations[action] || action;
  }

  /**
   * Translate entity type to Korean
   */
  private translateEntityType(entityType: string): string {
    const translations: Record<string, string> = {
      users: '사용자',
      shops: '샵',
      reservations: '예약',
      payments: '결제',
      reviews: '리뷰',
      posts: '게시물',
      points: '포인트',
      settings: '설정',
    };

    return translations[entityType] || entityType;
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

export const auditExportService = new AuditExportService();
```

### Step 3: Create API Routes

**File:** `src/routes/admin/audit-export.routes.ts`

```typescript
/**
 * Audit Log Export Routes
 */

import { Router } from 'express';
import { auditExportService } from '@/services/audit-export.service';
import { asyncHandler } from '@/middleware/async.middleware';
import { authenticate, requireAdmin } from '@/middleware/auth.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

router.use(authenticate, requireAdmin);

/**
 * POST /api/admin/audit/export
 * Export audit logs
 */
router.post(
  '/export',
  [
    body('format').isIn(['csv', 'json', 'pdf']),
    body('filters').optional().isObject(),
    body('includeDetails').optional().isBoolean(),
    body('maxRecords').optional().isInt({ min: 1, max: 100000 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { details: errors.array() } });
    }

    const result = await auditExportService.exportAuditLogs(req.body);

    res.json({ success: true, data: result });
  })
);

export default router;
```

---

## Admin Panel Implementation

### Step 4: Create AuditExportDialog Component

**File:** `src/components/audit/AuditExportDialog.tsx`

```tsx
/**
 * AuditExportDialog Component
 * Dialog for exporting audit logs
 */

'use client';

import React, { useState } from 'react';
import { Download, FileText, Code, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { AuditExportFormat, AuditExportFilter } from '@/types/audit-export.types';
import { DateRange } from 'react-day-picker';

interface AuditExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters?: AuditExportFilter;
}

const formatOptions = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, description: '스프레드시트 분석용' },
  { value: 'json', label: 'JSON', icon: Code, description: '프로그램 처리용' },
  { value: 'pdf', label: 'PDF', icon: FileText, description: '컴플라이언스 리포트용' },
];

export function AuditExportDialog({ isOpen, onClose, currentFilters }: AuditExportDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<AuditExportFormat>('csv');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    currentFilters?.startDate && currentFilters?.endDate
      ? {
          from: new Date(currentFilters.startDate),
          to: new Date(currentFilters.endDate),
        }
      : undefined
  );
  const [includeDetails, setIncludeDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const filters: AuditExportFilter = {
        ...currentFilters,
        startDate: dateRange?.from?.toISOString().split('T')[0],
        endDate: dateRange?.to?.toISOString().split('T')[0],
      };

      const response = await api.post('/admin/audit/export', {
        format,
        filters,
        includeDetails,
      });

      const result = response.data.data;

      if (result.fileUrl) {
        // Open download in new tab
        window.open(result.fileUrl, '_blank');

        toast({
          title: '내보내기 완료',
          description: `${result.recordCount.toLocaleString()}건의 감사 로그를 내보냈습니다.`,
        });
      } else {
        toast({
          title: '내보내기 완료',
          description: '내보낼 데이터가 없습니다.',
        });
      }

      onClose();
    } catch (error) {
      toast({
        title: '내보내기 실패',
        description: '감사 로그 내보내기에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            감사 로그 내보내기
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format selection */}
          <div className="space-y-2">
            <Label>내보내기 형식</Label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    onClick={() => setFormat(option.value as AuditExportFormat)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors text-center ${
                      format === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label>기간</Label>
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          </div>

          {/* Include details checkbox */}
          {format !== 'pdf' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDetails"
                checked={includeDetails}
                onCheckedChange={(checked) => setIncludeDetails(!!checked)}
              />
              <Label htmlFor="includeDetails" className="text-sm font-normal">
                상세 변경 내역 포함 (이전/이후 값)
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            취소
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                내보내는 중...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                내보내기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AuditExportDialog;
```

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/types/audit-export.types.ts` | **CREATE** | TypeScript types |
| `src/services/audit-export.service.ts` | **CREATE** | Export service |
| `src/routes/admin/audit-export.routes.ts` | **CREATE** | API routes |

### Admin Panel

| File | Action | Description |
|------|--------|-------------|
| `src/types/audit-export.types.ts` | **CREATE** | TypeScript types |
| `src/components/audit/AuditExportDialog.tsx` | **CREATE** | Export dialog |
| `src/components/audit/AuditLogViewer.tsx` | **MODIFY** | Add export button |

---

## Testing Plan

### Manual Testing

- [ ] CSV export works with Korean characters
- [ ] JSON export is valid
- [ ] PDF report generates correctly
- [ ] Date range filter works
- [ ] Include details option works
- [ ] Large exports complete successfully
- [ ] Download link works

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Export success rate | >99% |
| Export time (10K records) | <30 seconds |
| File format accuracy | 100% |
