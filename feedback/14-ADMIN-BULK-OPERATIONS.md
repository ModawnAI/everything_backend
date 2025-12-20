# Implementation Plan: Admin Bulk Operations

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 8-10 hours |
| **Risk Level** | Medium (data modification) |
| **Components Affected** | Backend + Admin Panel |
| **Dependencies** | Audit Logging (for tracking changes) |

## Problem Statement

Bulk operations are partially implemented in the admin panel:

```typescript
// Admin: Bulk action buttons exist but functionality is limited
// Cannot bulk update user status
// Cannot bulk approve/reject shops
// Cannot bulk cancel reservations
```

**Current State:**
- Individual record actions work
- Bulk selection UI exists in some tables
- Backend bulk endpoints are incomplete
- No confirmation/preview for bulk actions

**Impact:**
1. Time-consuming to manage multiple records
2. Inconsistent data when batch processing fails
3. No rollback capability for bulk changes
4. Missing audit trail for bulk operations

---

## Bulk Operations Required

### 1. User Management

| Operation | Description | Risk |
|-----------|-------------|------|
| **Bulk Status Update** | Activate/Deactivate multiple users | Medium |
| **Bulk Role Change** | Change roles for multiple users | High |
| **Bulk Delete** | Soft delete multiple users | High |
| **Bulk Send Email** | Send notification to selected users | Low |

### 2. Shop Management

| Operation | Description | Risk |
|-----------|-------------|------|
| **Bulk Approve** | Approve multiple pending shops | Medium |
| **Bulk Reject** | Reject multiple pending shops | Medium |
| **Bulk Status Update** | Activate/Suspend shops | Medium |
| **Bulk Category Change** | Update category for shops | Low |

### 3. Reservation Management

| Operation | Description | Risk |
|-----------|-------------|------|
| **Bulk Cancel** | Cancel multiple reservations | High |
| **Bulk Confirm** | Confirm multiple reservations | Medium |
| **Bulk Refund** | Process refunds for reservations | High |

### 4. Content Moderation

| Operation | Description | Risk |
|-----------|-------------|------|
| **Bulk Approve Reviews** | Approve pending reviews | Low |
| **Bulk Reject Reviews** | Reject/hide reviews | Low |
| **Bulk Delete Posts** | Remove posts | Medium |

---

## Backend Implementation

### Step 1: Create Bulk Operation Types

**File:** `src/types/bulk-operation.types.ts`

```typescript
/**
 * Bulk Operation Type Definitions
 */

// Bulk operation entity
export type BulkEntity = 'users' | 'shops' | 'reservations' | 'reviews' | 'posts';

// Bulk operation action
export type BulkAction =
  | 'update_status'
  | 'update_role'
  | 'approve'
  | 'reject'
  | 'delete'
  | 'cancel'
  | 'confirm'
  | 'refund'
  | 'send_notification';

// Bulk operation status
export type BulkOperationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

// Bulk operation request
export interface BulkOperationRequest {
  entity: BulkEntity;
  action: BulkAction;
  ids: string[];
  data?: Record<string, any>; // Action-specific data
  options?: {
    skipValidation?: boolean;
    sendNotification?: boolean;
    reason?: string;
  };
}

// Individual item result
export interface BulkItemResult {
  id: string;
  success: boolean;
  error?: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
}

// Bulk operation result
export interface BulkOperationResult {
  operationId: string;
  entity: BulkEntity;
  action: BulkAction;
  status: BulkOperationStatus;
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: BulkItemResult[];
  startedAt: string;
  completedAt: string | null;
  executedBy: string;
}

// Bulk operation job (for tracking)
export interface BulkOperationJob {
  id: string;
  userId: string;
  entity: BulkEntity;
  action: BulkAction;
  ids: string[];
  data: Record<string, any>;
  status: BulkOperationStatus;
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: BulkItemResult[];
  createdAt: string;
  completedAt: string | null;
}

// Preview result (before execution)
export interface BulkPreviewResult {
  entity: BulkEntity;
  action: BulkAction;
  itemCount: number;
  items: {
    id: string;
    name: string;
    currentState: Record<string, any>;
    proposedState: Record<string, any>;
    warnings: string[];
  }[];
  warnings: string[];
  canProceed: boolean;
}
```

### Step 2: Create Bulk Operation Service

**File:** `src/services/bulk-operation.service.ts`

```typescript
/**
 * Bulk Operation Service
 * Handles batch operations on multiple records
 */

import { supabase } from '@/config/supabase';
import { v4 as uuidv4 } from 'uuid';
import {
  BulkEntity,
  BulkAction,
  BulkOperationRequest,
  BulkOperationResult,
  BulkOperationJob,
  BulkItemResult,
  BulkPreviewResult,
} from '@/types/bulk-operation.types';
import { auditLogService } from './audit-log.service';
import { notificationService } from './notification.service';

// Maximum items per bulk operation
const MAX_BULK_ITEMS = 500;

// Action handlers by entity
type ActionHandler = (
  id: string,
  data: Record<string, any>,
  options: Record<string, any>
) => Promise<BulkItemResult>;

export class BulkOperationService {
  /**
   * Preview bulk operation (dry run)
   */
  async previewBulkOperation(
    request: BulkOperationRequest,
    userId: string
  ): Promise<BulkPreviewResult> {
    const { entity, action, ids, data } = request;

    // Validate request
    this.validateRequest(request);

    // Fetch current state of items
    const items = await this.fetchItems(entity, ids);
    const warnings: string[] = [];

    // Generate preview for each item
    const previewItems = items.map((item) => {
      const itemWarnings: string[] = [];
      const proposedState = this.calculateProposedState(entity, action, item, data || {});

      // Check for potential issues
      if (entity === 'users' && action === 'delete' && item.role === 'admin') {
        itemWarnings.push('관리자 계정은 삭제할 수 없습니다');
      }

      if (entity === 'reservations' && action === 'cancel' && item.status === 'completed') {
        itemWarnings.push('완료된 예약은 취소할 수 없습니다');
      }

      return {
        id: item.id,
        name: this.getItemName(entity, item),
        currentState: this.extractRelevantState(entity, item),
        proposedState,
        warnings: itemWarnings,
      };
    });

    // Overall warnings
    if (ids.length > 100) {
      warnings.push(`대량의 레코드(${ids.length}개)가 변경됩니다`);
    }

    const hasBlockingWarnings = previewItems.some((p) =>
      p.warnings.some((w) => w.includes('삭제할 수 없습니다') || w.includes('취소할 수 없습니다'))
    );

    return {
      entity,
      action,
      itemCount: ids.length,
      items: previewItems,
      warnings,
      canProceed: !hasBlockingWarnings,
    };
  }

  /**
   * Execute bulk operation
   */
  async executeBulkOperation(
    request: BulkOperationRequest,
    userId: string
  ): Promise<BulkOperationResult> {
    const { entity, action, ids, data, options } = request;
    const operationId = uuidv4();
    const startedAt = new Date().toISOString();

    // Validate request
    this.validateRequest(request);

    // Create job record
    await this.createJobRecord(operationId, userId, request);

    const results: BulkItemResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each item
    for (const id of ids) {
      try {
        const result = await this.processItem(entity, action, id, data || {}, options || {});
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    const completedAt = new Date().toISOString();
    const status = failureCount === 0 ? 'completed' : failureCount === ids.length ? 'failed' : 'partial';

    // Update job record
    await this.updateJobRecord(operationId, {
      status,
      successCount,
      failureCount,
      results,
      completedAt,
    });

    // Create audit log
    await auditLogService.log({
      userId,
      action: `bulk_${action}`,
      entityType: entity,
      entityId: operationId,
      details: {
        totalCount: ids.length,
        successCount,
        failureCount,
        ids,
      },
    });

    return {
      operationId,
      entity,
      action,
      status,
      totalCount: ids.length,
      successCount,
      failureCount,
      results,
      startedAt,
      completedAt,
      executedBy: userId,
    };
  }

  /**
   * Get bulk operation job
   */
  async getJob(jobId: string, userId: string): Promise<BulkOperationJob | null> {
    const { data, error } = await supabase
      .from('bulk_operation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      entity: data.entity,
      action: data.action,
      ids: data.ids,
      data: data.data,
      status: data.status,
      totalCount: data.total_count,
      successCount: data.success_count,
      failureCount: data.failure_count,
      results: data.results,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    };
  }

  /**
   * List bulk operation jobs
   */
  async listJobs(userId: string, limit = 20): Promise<BulkOperationJob[]> {
    const { data, error } = await supabase
      .from('bulk_operation_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list jobs: ${error.message}`);
    }

    return (data || []).map((d) => ({
      id: d.id,
      userId: d.user_id,
      entity: d.entity,
      action: d.action,
      ids: d.ids,
      data: d.data,
      status: d.status,
      totalCount: d.total_count,
      successCount: d.success_count,
      failureCount: d.failure_count,
      results: d.results,
      createdAt: d.created_at,
      completedAt: d.completed_at,
    }));
  }

  // Private methods

  private validateRequest(request: BulkOperationRequest): void {
    const { entity, action, ids } = request;

    if (!ids || ids.length === 0) {
      throw new Error('No items selected');
    }

    if (ids.length > MAX_BULK_ITEMS) {
      throw new Error(`Maximum ${MAX_BULK_ITEMS} items per operation`);
    }

    // Validate entity-action combination
    const validActions: Record<BulkEntity, BulkAction[]> = {
      users: ['update_status', 'update_role', 'delete', 'send_notification'],
      shops: ['update_status', 'approve', 'reject', 'delete'],
      reservations: ['cancel', 'confirm', 'refund'],
      reviews: ['approve', 'reject', 'delete'],
      posts: ['approve', 'delete'],
    };

    if (!validActions[entity]?.includes(action)) {
      throw new Error(`Invalid action '${action}' for entity '${entity}'`);
    }
  }

  private async fetchItems(entity: BulkEntity, ids: string[]): Promise<any[]> {
    const { data, error } = await supabase.from(entity).select('*').in('id', ids);

    if (error) {
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    return data || [];
  }

  private getItemName(entity: BulkEntity, item: any): string {
    switch (entity) {
      case 'users':
        return item.email || item.nickname || item.id;
      case 'shops':
        return item.name || item.id;
      case 'reservations':
        return `예약 #${item.id.slice(0, 8)}`;
      case 'reviews':
        return `리뷰 #${item.id.slice(0, 8)}`;
      case 'posts':
        return item.title || `게시물 #${item.id.slice(0, 8)}`;
      default:
        return item.id;
    }
  }

  private extractRelevantState(entity: BulkEntity, item: any): Record<string, any> {
    switch (entity) {
      case 'users':
        return { status: item.status, role: item.role };
      case 'shops':
        return { status: item.status, is_verified: item.is_verified };
      case 'reservations':
        return { status: item.status };
      case 'reviews':
        return { status: item.status };
      case 'posts':
        return { status: item.status };
      default:
        return {};
    }
  }

  private calculateProposedState(
    entity: BulkEntity,
    action: BulkAction,
    item: any,
    data: Record<string, any>
  ): Record<string, any> {
    switch (action) {
      case 'update_status':
        return { status: data.status };
      case 'update_role':
        return { role: data.role };
      case 'approve':
        return { status: 'approved' };
      case 'reject':
        return { status: 'rejected' };
      case 'delete':
        return { status: 'deleted' };
      case 'cancel':
        return { status: 'cancelled_by_admin' };
      case 'confirm':
        return { status: 'confirmed' };
      default:
        return data;
    }
  }

  private async processItem(
    entity: BulkEntity,
    action: BulkAction,
    id: string,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<BulkItemResult> {
    // Get current state
    const { data: item, error: fetchError } = await supabase
      .from(entity)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      return { id, success: false, error: 'Item not found' };
    }

    const previousState = this.extractRelevantState(entity, item);

    try {
      // Execute action
      await this.executeAction(entity, action, id, item, data, options);

      // Get new state
      const { data: updatedItem } = await supabase.from(entity).select('*').eq('id', id).single();

      const newState = updatedItem ? this.extractRelevantState(entity, updatedItem) : {};

      return { id, success: true, previousState, newState };
    } catch (error) {
      return {
        id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        previousState,
      };
    }
  }

  private async executeAction(
    entity: BulkEntity,
    action: BulkAction,
    id: string,
    item: any,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<void> {
    switch (entity) {
      case 'users':
        await this.executeUserAction(action, id, item, data, options);
        break;
      case 'shops':
        await this.executeShopAction(action, id, item, data, options);
        break;
      case 'reservations':
        await this.executeReservationAction(action, id, item, data, options);
        break;
      case 'reviews':
        await this.executeReviewAction(action, id, item, data, options);
        break;
      case 'posts':
        await this.executePostAction(action, id, item, data, options);
        break;
    }
  }

  private async executeUserAction(
    action: BulkAction,
    id: string,
    item: any,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case 'update_status':
        await supabase.from('users').update({ status: data.status }).eq('id', id);
        break;
      case 'update_role':
        if (item.role === 'admin') {
          throw new Error('Cannot change admin role');
        }
        await supabase.from('users').update({ role: data.role }).eq('id', id);
        break;
      case 'delete':
        if (item.role === 'admin') {
          throw new Error('Cannot delete admin user');
        }
        await supabase.from('users').update({ status: 'deleted' }).eq('id', id);
        break;
      case 'send_notification':
        await notificationService.sendToUser(id, data.title, data.body);
        break;
    }
  }

  private async executeShopAction(
    action: BulkAction,
    id: string,
    item: any,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case 'update_status':
        await supabase.from('shops').update({ status: data.status }).eq('id', id);
        break;
      case 'approve':
        await supabase
          .from('shops')
          .update({ status: 'active', is_verified: true })
          .eq('id', id);
        break;
      case 'reject':
        await supabase
          .from('shops')
          .update({ status: 'rejected', rejection_reason: options.reason })
          .eq('id', id);
        break;
      case 'delete':
        await supabase.from('shops').update({ status: 'deleted' }).eq('id', id);
        break;
    }
  }

  private async executeReservationAction(
    action: BulkAction,
    id: string,
    item: any,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case 'cancel':
        if (['completed', 'cancelled_by_user', 'cancelled_by_shop'].includes(item.status)) {
          throw new Error('Cannot cancel this reservation');
        }
        await supabase
          .from('reservations')
          .update({
            status: 'cancelled_by_shop',
            cancellation_reason: options.reason || 'Bulk cancellation by admin',
          })
          .eq('id', id);
        break;
      case 'confirm':
        if (item.status !== 'requested') {
          throw new Error('Can only confirm requested reservations');
        }
        await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', id);
        break;
    }
  }

  private async executeReviewAction(
    action: BulkAction,
    id: string,
    item: any,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case 'approve':
        await supabase.from('reviews').update({ status: 'approved' }).eq('id', id);
        break;
      case 'reject':
        await supabase
          .from('reviews')
          .update({ status: 'rejected', rejection_reason: options.reason })
          .eq('id', id);
        break;
      case 'delete':
        await supabase.from('reviews').update({ status: 'deleted' }).eq('id', id);
        break;
    }
  }

  private async executePostAction(
    action: BulkAction,
    id: string,
    item: any,
    data: Record<string, any>,
    options: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case 'approve':
        await supabase.from('posts').update({ status: 'published' }).eq('id', id);
        break;
      case 'delete':
        await supabase.from('posts').update({ status: 'deleted' }).eq('id', id);
        break;
    }
  }

  private async createJobRecord(
    operationId: string,
    userId: string,
    request: BulkOperationRequest
  ): Promise<void> {
    await supabase.from('bulk_operation_jobs').insert({
      id: operationId,
      user_id: userId,
      entity: request.entity,
      action: request.action,
      ids: request.ids,
      data: request.data || {},
      status: 'processing',
      total_count: request.ids.length,
      success_count: 0,
      failure_count: 0,
      results: [],
      created_at: new Date().toISOString(),
    });
  }

  private async updateJobRecord(
    operationId: string,
    updates: Partial<BulkOperationJob>
  ): Promise<void> {
    await supabase
      .from('bulk_operation_jobs')
      .update({
        status: updates.status,
        success_count: updates.successCount,
        failure_count: updates.failureCount,
        results: updates.results,
        completed_at: updates.completedAt,
      })
      .eq('id', operationId);
  }
}

export const bulkOperationService = new BulkOperationService();
```

### Step 3: Create API Routes

**File:** `src/routes/admin/bulk.routes.ts`

```typescript
/**
 * Admin Bulk Operation Routes
 */

import { Router } from 'express';
import { bulkOperationService } from '@/services/bulk-operation.service';
import { asyncHandler } from '@/middleware/async.middleware';
import { authenticate, requireAdmin } from '@/middleware/auth.middleware';
import { body, param, validationResult } from 'express-validator';

const router = Router();

router.use(authenticate, requireAdmin);

/**
 * POST /api/admin/bulk/preview
 * Preview bulk operation
 */
router.post(
  '/preview',
  [
    body('entity').isIn(['users', 'shops', 'reservations', 'reviews', 'posts']),
    body('action').notEmpty(),
    body('ids').isArray({ min: 1, max: 500 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { details: errors.array() } });
    }

    const preview = await bulkOperationService.previewBulkOperation(req.body, req.user!.id);

    res.json({ success: true, data: preview });
  })
);

/**
 * POST /api/admin/bulk/execute
 * Execute bulk operation
 */
router.post(
  '/execute',
  [
    body('entity').isIn(['users', 'shops', 'reservations', 'reviews', 'posts']),
    body('action').notEmpty(),
    body('ids').isArray({ min: 1, max: 500 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { details: errors.array() } });
    }

    const result = await bulkOperationService.executeBulkOperation(req.body, req.user!.id);

    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/admin/bulk/jobs
 * List bulk operation jobs
 */
router.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const jobs = await bulkOperationService.listJobs(req.user!.id);
    res.json({ success: true, data: jobs });
  })
);

/**
 * GET /api/admin/bulk/jobs/:jobId
 * Get bulk operation job
 */
router.get(
  '/jobs/:jobId',
  [param('jobId').isUUID()],
  asyncHandler(async (req, res) => {
    const job = await bulkOperationService.getJob(req.params.jobId, req.user!.id);

    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Job not found' } });
    }

    res.json({ success: true, data: job });
  })
);

export default router;
```

---

## Admin Panel Implementation

### Step 4: Create BulkActionsBar Component

**File:** `src/components/bulk/BulkActionsBar.tsx`

```tsx
/**
 * BulkActionsBar Component
 * Sticky bar for bulk actions on selected items
 */

'use client';

import React, { useState } from 'react';
import { X, Trash2, CheckCircle, XCircle, Ban, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBulkOperation } from '@/hooks/use-bulk-operation';
import type { BulkEntity, BulkAction } from '@/types/bulk-operation.types';

interface BulkActionsBarProps {
  entity: BulkEntity;
  selectedIds: string[];
  onClearSelection: () => void;
  onOperationComplete?: () => void;
}

interface ActionConfig {
  action: BulkAction;
  label: string;
  icon: React.ElementType;
  variant: 'default' | 'destructive' | 'outline';
  requiresConfirmation: boolean;
  data?: Record<string, any>;
}

const actionConfigs: Record<BulkEntity, ActionConfig[]> = {
  users: [
    { action: 'update_status', label: '활성화', icon: CheckCircle, variant: 'default', requiresConfirmation: true, data: { status: 'active' } },
    { action: 'update_status', label: '비활성화', icon: Ban, variant: 'outline', requiresConfirmation: true, data: { status: 'inactive' } },
    { action: 'delete', label: '삭제', icon: Trash2, variant: 'destructive', requiresConfirmation: true },
  ],
  shops: [
    { action: 'approve', label: '승인', icon: CheckCircle, variant: 'default', requiresConfirmation: true },
    { action: 'reject', label: '거절', icon: XCircle, variant: 'outline', requiresConfirmation: true },
    { action: 'update_status', label: '정지', icon: Ban, variant: 'destructive', requiresConfirmation: true, data: { status: 'suspended' } },
  ],
  reservations: [
    { action: 'confirm', label: '확정', icon: CheckCircle, variant: 'default', requiresConfirmation: true },
    { action: 'cancel', label: '취소', icon: XCircle, variant: 'destructive', requiresConfirmation: true },
  ],
  reviews: [
    { action: 'approve', label: '승인', icon: CheckCircle, variant: 'default', requiresConfirmation: true },
    { action: 'reject', label: '거절', icon: XCircle, variant: 'outline', requiresConfirmation: true },
    { action: 'delete', label: '삭제', icon: Trash2, variant: 'destructive', requiresConfirmation: true },
  ],
  posts: [
    { action: 'approve', label: '게시', icon: CheckCircle, variant: 'default', requiresConfirmation: true },
    { action: 'delete', label: '삭제', icon: Trash2, variant: 'destructive', requiresConfirmation: true },
  ],
};

export function BulkActionsBar({
  entity,
  selectedIds,
  onClearSelection,
  onOperationComplete,
}: BulkActionsBarProps) {
  const { executeBulk, previewBulk, isExecuting } = useBulkOperation();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: ActionConfig | null;
  }>({ open: false, action: null });

  const actions = actionConfigs[entity] || [];

  if (selectedIds.length === 0) return null;

  const handleActionClick = async (action: ActionConfig) => {
    if (action.requiresConfirmation) {
      // Preview first
      const preview = await previewBulk({
        entity,
        action: action.action,
        ids: selectedIds,
        data: action.data,
      });

      if (!preview.canProceed) {
        // Show warning and prevent
        return;
      }

      setConfirmDialog({ open: true, action });
    } else {
      await executeAction(action);
    }
  };

  const executeAction = async (action: ActionConfig) => {
    const result = await executeBulk({
      entity,
      action: action.action,
      ids: selectedIds,
      data: action.data,
    });

    if (result.status === 'completed' || result.status === 'partial') {
      onClearSelection();
      onOperationComplete?.();
    }

    setConfirmDialog({ open: false, action: null });
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 p-4 animate-in slide-in-from-bottom">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              {selectedIds.length}개 선택됨
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              <X className="h-4 w-4 mr-1" />
              선택 해제
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={`${action.action}-${index}`}
                  variant={action.variant}
                  size="sm"
                  onClick={() => handleActionClick(action)}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4 mr-1" />
                  )}
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일괄 작업 확인</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.length}개의 항목에 대해 '{confirmDialog.action?.label}' 작업을
              수행하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없을 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.action && executeAction(confirmDialog.action)}
              className={
                confirmDialog.action?.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default BulkActionsBar;
```

---

## Files to Create/Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/migrations/XXX_create_bulk_jobs.sql` | **CREATE** | Database migration |
| `src/types/bulk-operation.types.ts` | **CREATE** | TypeScript types |
| `src/services/bulk-operation.service.ts` | **CREATE** | Bulk operation service |
| `src/routes/admin/bulk.routes.ts` | **CREATE** | API routes |

### Admin Panel

| File | Action | Description |
|------|--------|-------------|
| `src/types/bulk-operation.types.ts` | **CREATE** | TypeScript types |
| `src/hooks/use-bulk-operation.ts` | **CREATE** | Bulk operation hook |
| `src/components/bulk/BulkActionsBar.tsx` | **CREATE** | Bulk actions bar |
| `src/components/users/UserTable.tsx` | **MODIFY** | Add bulk selection |
| `src/components/shop/ShopTable.tsx` | **MODIFY** | Add bulk selection |

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Deploy backend service
- [ ] Deploy admin panel components
- [ ] Add bulk selection to tables
- [ ] Test preview functionality
- [ ] Test bulk operations
- [ ] Verify audit logging
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Bulk operation success rate | >95% |
| Time saved vs individual actions | >80% |
| Error handling coverage | 100% |
| Audit log completeness | 100% |
