# Plan 29: Shop Notifications & Staff Management

## Overview
This plan implements a shop-only notification system and basic staff management features. Super admins can send announcements to all registered shops, and shop owners can manage their staff members for revenue tracking. This addresses Phase 6.2 feedback items from IMPLEMENTATION_PLAN.md.

**Feedback Items Addressed:**
- 입점된 샵들에게만 공지 및 알림 기능
- 직원별 매출 관리 (Basic staff management)

---

## 1. Database Schema

### Migration: 010_add_shop_notifications_staff.sql

```sql
-- ============================================
-- Shop Notifications Table
-- ============================================
CREATE TABLE shop_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  notification_type VARCHAR(50) DEFAULT 'announcement', -- announcement, update, alert, promotion
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  target_categories VARCHAR(50)[], -- null = all shops, or specific categories
  send_push BOOLEAN DEFAULT true,
  send_in_app BOOLEAN DEFAULT true,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track which shops received/read notifications
CREATE TABLE shop_notification_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES shop_notifications(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(notification_id, shop_id)
);

-- Indexes for notifications
CREATE INDEX idx_shop_notifications_sent ON shop_notifications(sent_at DESC);
CREATE INDEX idx_shop_notifications_type ON shop_notifications(notification_type);
CREATE INDEX idx_notification_receipts_shop ON shop_notification_receipts(shop_id);
CREATE INDEX idx_notification_receipts_unread ON shop_notification_receipts(shop_id) WHERE read_at IS NULL;

-- ============================================
-- Staff Management Table
-- ============================================
CREATE TABLE shop_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  profile_image TEXT,
  role VARCHAR(50) DEFAULT 'staff', -- owner, manager, staff
  phone VARCHAR(20),
  email VARCHAR(255),
  commission_rate DECIMAL(5, 2) DEFAULT 0, -- Commission percentage
  is_active BOOLEAN DEFAULT true,
  hire_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for staff lookups
CREATE INDEX idx_shop_staff_shop ON shop_staff(shop_id);
CREATE INDEX idx_shop_staff_active ON shop_staff(shop_id) WHERE is_active = true;

-- Link reservations to staff (if not already exists)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES shop_staff(id);
CREATE INDEX IF NOT EXISTS idx_reservations_staff ON reservations(staff_id);

-- ============================================
-- Views for Analytics
-- ============================================

-- Staff revenue summary
CREATE OR REPLACE VIEW staff_revenue_summary AS
SELECT
  s.id AS staff_id,
  s.shop_id,
  s.name AS staff_name,
  COUNT(r.id) AS total_reservations,
  SUM(CASE WHEN r.status = 'completed' THEN p.amount ELSE 0 END) AS total_revenue,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS completed_count,
  AVG(rev.rating) AS avg_rating
FROM shop_staff s
LEFT JOIN reservations r ON r.staff_id = s.id
LEFT JOIN payments p ON p.reservation_id = r.id
LEFT JOIN reviews rev ON rev.reservation_id = r.id
WHERE s.is_active = true
GROUP BY s.id, s.shop_id, s.name;
```

---

## 2. Backend Implementation

### 2.1 Types

**File: `src/types/shop-notification.types.ts`**

```typescript
export type NotificationType = 'announcement' | 'update' | 'alert' | 'promotion';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ShopNotification {
  id: string;
  title: string;
  content: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  targetCategories?: string[];
  sendPush: boolean;
  sendInApp: boolean;
  scheduledAt?: Date;
  sentAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShopNotificationDto {
  title: string;
  content: string;
  notificationType?: NotificationType;
  priority?: NotificationPriority;
  targetCategories?: string[];
  sendPush?: boolean;
  sendInApp?: boolean;
  scheduledAt?: string;
}

export interface ShopNotificationReceipt {
  id: string;
  notificationId: string;
  shopId: string;
  deliveredAt: Date;
  readAt?: Date;
}

export interface ShopNotificationWithStats extends ShopNotification {
  totalRecipients: number;
  deliveredCount: number;
  readCount: number;
}
```

**File: `src/types/shop-staff.types.ts`**

```typescript
export type StaffRole = 'owner' | 'manager' | 'staff';

export interface ShopStaff {
  id: string;
  shopId: string;
  name: string;
  nickname?: string;
  profileImage?: string;
  role: StaffRole;
  phone?: string;
  email?: string;
  commissionRate: number;
  isActive: boolean;
  hireDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffDto {
  name: string;
  nickname?: string;
  profileImage?: string;
  role?: StaffRole;
  phone?: string;
  email?: string;
  commissionRate?: number;
  hireDate?: string;
  notes?: string;
}

export interface UpdateStaffDto extends Partial<CreateStaffDto> {
  isActive?: boolean;
}

export interface StaffRevenueSummary {
  staffId: string;
  staffName: string;
  totalReservations: number;
  totalRevenue: number;
  completedCount: number;
  avgRating: number;
}
```

### 2.2 Shop Notification Service

**File: `src/services/admin/shop-notification.service.ts`**

```typescript
import { supabase } from '@/config/supabase';
import { FCMService } from '@/services/fcm.service';
import {
  ShopNotification,
  CreateShopNotificationDto,
  ShopNotificationWithStats,
} from '@/types/shop-notification.types';

export class ShopNotificationService {
  private fcmService: FCMService;

  constructor() {
    this.fcmService = new FCMService();
  }

  /**
   * Create a new shop notification
   */
  async createNotification(
    adminUserId: string,
    dto: CreateShopNotificationDto
  ): Promise<ShopNotification> {
    const { data, error } = await supabase
      .from('shop_notifications')
      .insert({
        title: dto.title,
        content: dto.content,
        notification_type: dto.notificationType || 'announcement',
        priority: dto.priority || 'normal',
        target_categories: dto.targetCategories,
        send_push: dto.sendPush ?? true,
        send_in_app: dto.sendInApp ?? true,
        scheduled_at: dto.scheduledAt,
        created_by: adminUserId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    // If not scheduled, send immediately
    if (!dto.scheduledAt) {
      await this.sendNotification(data.id);
    }

    return this.mapNotification(data);
  }

  /**
   * Send notification to all target shops
   */
  async sendNotification(notificationId: string): Promise<void> {
    // Get notification
    const { data: notification, error: fetchError } = await supabase
      .from('shop_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new Error('Notification not found');
    }

    if (notification.sent_at) {
      throw new Error('Notification already sent');
    }

    // Get target shops
    let shopsQuery = supabase
      .from('shops')
      .select('id, user_id, name')
      .eq('is_active', true);

    // Filter by category if specified
    if (notification.target_categories && notification.target_categories.length > 0) {
      shopsQuery = shopsQuery.in('category', notification.target_categories);
    }

    const { data: shops, error: shopsError } = await shopsQuery;

    if (shopsError) {
      throw new Error(`Failed to fetch shops: ${shopsError.message}`);
    }

    if (!shops || shops.length === 0) {
      throw new Error('No target shops found');
    }

    // Create receipts
    const receipts = shops.map(shop => ({
      notification_id: notificationId,
      shop_id: shop.id,
    }));

    await supabase.from('shop_notification_receipts').insert(receipts);

    // Update notification as sent
    await supabase
      .from('shop_notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', notificationId);

    // Send push notifications if enabled
    if (notification.send_push) {
      const shopOwnerIds = shops.map(s => s.user_id).filter(Boolean);

      // Get FCM tokens for shop owners
      const { data: tokens } = await supabase
        .from('fcm_tokens')
        .select('token')
        .in('user_id', shopOwnerIds);

      if (tokens && tokens.length > 0) {
        await this.fcmService.sendMulticast({
          tokens: tokens.map(t => t.token),
          title: notification.title,
          body: notification.content.substring(0, 100), // Truncate for push
          data: {
            type: 'shop_notification',
            notificationId,
          },
        });
      }
    }
  }

  /**
   * Get all notifications with stats
   */
  async getNotifications(options: {
    page?: number;
    limit?: number;
    type?: string;
  } = {}): Promise<{ notifications: ShopNotificationWithStats[]; total: number }> {
    const { page = 1, limit = 20, type } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('shop_notifications')
      .select(`
        *,
        shop_notification_receipts (count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('notification_type', type);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    // Get read counts separately
    const notificationIds = (data || []).map(n => n.id);
    const { data: readCounts } = await supabase
      .from('shop_notification_receipts')
      .select('notification_id')
      .in('notification_id', notificationIds)
      .not('read_at', 'is', null);

    const readCountMap = new Map<string, number>();
    (readCounts || []).forEach(r => {
      readCountMap.set(r.notification_id, (readCountMap.get(r.notification_id) || 0) + 1);
    });

    const notifications = (data || []).map(n => ({
      ...this.mapNotification(n),
      totalRecipients: n.shop_notification_receipts?.[0]?.count || 0,
      deliveredCount: n.shop_notification_receipts?.[0]?.count || 0,
      readCount: readCountMap.get(n.id) || 0,
    }));

    return {
      notifications,
      total: count || 0,
    };
  }

  /**
   * Get notifications for a shop
   */
  async getShopNotifications(
    shopId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: any[]; unreadCount: number }> {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('shop_notification_receipts')
      .select(`
        id,
        delivered_at,
        read_at,
        shop_notifications (
          id,
          title,
          content,
          notification_type,
          priority,
          sent_at
        )
      `)
      .eq('shop_id', shopId)
      .order('delivered_at', { ascending: false });

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch shop notifications: ${error.message}`);
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('shop_notification_receipts')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .is('read_at', null);

    const notifications = (data || []).map(r => ({
      id: r.id,
      notificationId: r.shop_notifications?.id,
      title: r.shop_notifications?.title,
      content: r.shop_notifications?.content,
      type: r.shop_notifications?.notification_type,
      priority: r.shop_notifications?.priority,
      deliveredAt: r.delivered_at,
      readAt: r.read_at,
      isRead: !!r.read_at,
    }));

    return {
      notifications,
      unreadCount: unreadCount || 0,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(shopId: string, receiptId: string): Promise<void> {
    const { error } = await supabase
      .from('shop_notification_receipts')
      .update({ read_at: new Date().toISOString() })
      .eq('id', receiptId)
      .eq('shop_id', shopId);

    if (error) {
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read for a shop
   */
  async markAllAsRead(shopId: string): Promise<void> {
    const { error } = await supabase
      .from('shop_notification_receipts')
      .update({ read_at: new Date().toISOString() })
      .eq('shop_id', shopId)
      .is('read_at', null);

    if (error) {
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  }

  private mapNotification(data: any): ShopNotification {
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      notificationType: data.notification_type,
      priority: data.priority,
      targetCategories: data.target_categories,
      sendPush: data.send_push,
      sendInApp: data.send_in_app,
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
```

### 2.3 Staff Service

**File: `src/services/shop-owner/staff.service.ts`**

```typescript
import { supabase } from '@/config/supabase';
import {
  ShopStaff,
  CreateStaffDto,
  UpdateStaffDto,
  StaffRevenueSummary,
} from '@/types/shop-staff.types';

export class ShopStaffService {
  /**
   * Get all staff for a shop
   */
  async getStaff(
    shopId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<ShopStaff[]> {
    let query = supabase
      .from('shop_staff')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at');

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    return (data || []).map(this.mapStaff);
  }

  /**
   * Get single staff member
   */
  async getStaffById(shopId: string, staffId: string): Promise<ShopStaff | null> {
    const { data, error } = await supabase
      .from('shop_staff')
      .select('*')
      .eq('id', staffId)
      .eq('shop_id', shopId)
      .single();

    if (error) {
      return null;
    }

    return this.mapStaff(data);
  }

  /**
   * Create new staff member
   */
  async createStaff(shopId: string, dto: CreateStaffDto): Promise<ShopStaff> {
    const { data, error } = await supabase
      .from('shop_staff')
      .insert({
        shop_id: shopId,
        name: dto.name,
        nickname: dto.nickname,
        profile_image: dto.profileImage,
        role: dto.role || 'staff',
        phone: dto.phone,
        email: dto.email,
        commission_rate: dto.commissionRate || 0,
        hire_date: dto.hireDate,
        notes: dto.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create staff: ${error.message}`);
    }

    return this.mapStaff(data);
  }

  /**
   * Update staff member
   */
  async updateStaff(
    shopId: string,
    staffId: string,
    dto: UpdateStaffDto
  ): Promise<ShopStaff> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.profileImage !== undefined) updateData.profile_image = dto.profileImage;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.commissionRate !== undefined) updateData.commission_rate = dto.commissionRate;
    if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
    if (dto.hireDate !== undefined) updateData.hire_date = dto.hireDate;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const { data, error } = await supabase
      .from('shop_staff')
      .update(updateData)
      .eq('id', staffId)
      .eq('shop_id', shopId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update staff: ${error.message}`);
    }

    return this.mapStaff(data);
  }

  /**
   * Delete (deactivate) staff member
   */
  async deleteStaff(shopId: string, staffId: string): Promise<void> {
    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from('shop_staff')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', staffId)
      .eq('shop_id', shopId);

    if (error) {
      throw new Error(`Failed to delete staff: ${error.message}`);
    }
  }

  /**
   * Get staff revenue summary
   */
  async getStaffRevenue(
    shopId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<StaffRevenueSummary[]> {
    const { startDate, endDate } = options;

    // Use view or calculate manually
    let query = supabase
      .from('staff_revenue_summary')
      .select('*')
      .eq('shop_id', shopId);

    const { data, error } = await query;

    if (error) {
      // Fallback to manual calculation
      return this.calculateStaffRevenue(shopId, startDate, endDate);
    }

    return (data || []).map(item => ({
      staffId: item.staff_id,
      staffName: item.staff_name,
      totalReservations: item.total_reservations || 0,
      totalRevenue: item.total_revenue || 0,
      completedCount: item.completed_count || 0,
      avgRating: item.avg_rating || 0,
    }));
  }

  /**
   * Manual revenue calculation fallback
   */
  private async calculateStaffRevenue(
    shopId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StaffRevenueSummary[]> {
    // Get staff list
    const staff = await this.getStaff(shopId);

    const summaries: StaffRevenueSummary[] = [];

    for (const s of staff) {
      let query = supabase
        .from('reservations')
        .select(`
          id,
          status,
          payments (amount),
          reviews (rating)
        `)
        .eq('staff_id', s.id);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: reservations } = await query;

      const totalReservations = reservations?.length || 0;
      const completedReservations = reservations?.filter(r => r.status === 'completed') || [];
      const totalRevenue = completedReservations.reduce((sum, r) =>
        sum + (r.payments?.[0]?.amount || 0), 0
      );
      const ratings = reservations?.flatMap(r => r.reviews?.map(rev => rev.rating) || []) || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

      summaries.push({
        staffId: s.id,
        staffName: s.name,
        totalReservations,
        totalRevenue,
        completedCount: completedReservations.length,
        avgRating,
      });
    }

    return summaries;
  }

  /**
   * Assign staff to reservation
   */
  async assignToReservation(
    shopId: string,
    reservationId: string,
    staffId: string
  ): Promise<void> {
    // Verify staff belongs to shop
    const staff = await this.getStaffById(shopId, staffId);
    if (!staff) {
      throw new Error('Staff not found');
    }

    const { error } = await supabase
      .from('reservations')
      .update({ staff_id: staffId })
      .eq('id', reservationId)
      .eq('shop_id', shopId);

    if (error) {
      throw new Error(`Failed to assign staff: ${error.message}`);
    }
  }

  private mapStaff(data: any): ShopStaff {
    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      nickname: data.nickname,
      profileImage: data.profile_image,
      role: data.role,
      phone: data.phone,
      email: data.email,
      commissionRate: parseFloat(data.commission_rate) || 0,
      isActive: data.is_active,
      hireDate: data.hire_date ? new Date(data.hire_date) : undefined,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
```

### 2.4 Controllers

**File: `src/controllers/admin/shop-notification.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { ShopNotificationService } from '@/services/admin/shop-notification.service';
import { successResponse, errorResponse } from '@/utils/response';

const notificationService = new ShopNotificationService();

export class ShopNotificationAdminController {
  /**
   * GET /admin/shop-notifications
   */
  async getNotifications(req: Request, res: Response) {
    try {
      const { page, limit, type } = req.query;

      const result = await notificationService.getNotifications({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as string,
      });

      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * POST /admin/shop-notifications
   */
  async createNotification(req: Request, res: Response) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      const { title, content, notificationType, priority, targetCategories, sendPush, sendInApp, scheduledAt } = req.body;

      if (!title || !content) {
        return errorResponse(res, 'Title and content are required', 400);
      }

      const notification = await notificationService.createNotification(adminUserId, {
        title,
        content,
        notificationType,
        priority,
        targetCategories,
        sendPush,
        sendInApp,
        scheduledAt,
      });

      return successResponse(res, notification, 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * POST /admin/shop-notifications/:id/send
   */
  async sendNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await notificationService.sendNotification(id);

      return successResponse(res, { message: 'Notification sent successfully' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

**File: `src/controllers/shop-owner/staff.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { ShopStaffService } from '@/services/shop-owner/staff.service';
import { successResponse, errorResponse } from '@/utils/response';

const staffService = new ShopStaffService();

export class ShopStaffController {
  /**
   * GET /shop-owner/staff
   */
  async getStaff(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { includeInactive } = req.query;

      const staff = await staffService.getStaff(shopId, {
        includeInactive: includeInactive === 'true',
      });

      return successResponse(res, { staff });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * GET /shop-owner/staff/:id
   */
  async getStaffById(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { id } = req.params;

      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const staff = await staffService.getStaffById(shopId, id);

      if (!staff) {
        return errorResponse(res, 'Staff not found', 404);
      }

      return successResponse(res, staff);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * POST /shop-owner/staff
   */
  async createStaff(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { name, nickname, role, phone, email, commissionRate, hireDate, notes } = req.body;

      if (!name) {
        return errorResponse(res, 'Name is required', 400);
      }

      const staff = await staffService.createStaff(shopId, {
        name,
        nickname,
        role,
        phone,
        email,
        commissionRate,
        hireDate,
        notes,
      });

      return successResponse(res, staff, 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * PUT /shop-owner/staff/:id
   */
  async updateStaff(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { id } = req.params;

      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const staff = await staffService.updateStaff(shopId, id, req.body);

      return successResponse(res, staff);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * DELETE /shop-owner/staff/:id
   */
  async deleteStaff(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { id } = req.params;

      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      await staffService.deleteStaff(shopId, id);

      return successResponse(res, { message: 'Staff deleted successfully' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * GET /shop-owner/staff/revenue
   */
  async getStaffRevenue(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { startDate, endDate } = req.query;

      const revenue = await staffService.getStaffRevenue(shopId, {
        startDate: startDate as string,
        endDate: endDate as string,
      });

      return successResponse(res, { revenue });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * POST /shop-owner/reservations/:reservationId/assign-staff
   */
  async assignStaffToReservation(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { reservationId } = req.params;
      const { staffId } = req.body;

      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      if (!staffId) {
        return errorResponse(res, 'Staff ID is required', 400);
      }

      await staffService.assignToReservation(shopId, reservationId, staffId);

      return successResponse(res, { message: 'Staff assigned successfully' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

**File: `src/controllers/shop-owner/notification.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { ShopNotificationService } from '@/services/admin/shop-notification.service';
import { successResponse, errorResponse } from '@/utils/response';

const notificationService = new ShopNotificationService();

export class ShopOwnerNotificationController {
  /**
   * GET /shop-owner/notifications
   */
  async getNotifications(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { page, limit, unreadOnly } = req.query;

      const result = await notificationService.getShopNotifications(shopId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        unreadOnly: unreadOnly === 'true',
      });

      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * POST /shop-owner/notifications/:id/read
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { id } = req.params;

      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      await notificationService.markAsRead(shopId, id);

      return successResponse(res, { message: 'Marked as read' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * POST /shop-owner/notifications/read-all
   */
  async markAllAsRead(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      await notificationService.markAllAsRead(shopId);

      return successResponse(res, { message: 'All marked as read' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

### 2.5 Routes

**File: `src/routes/admin/shop-notification.routes.ts`**

```typescript
import { Router } from 'express';
import { ShopNotificationAdminController } from '@/controllers/admin/shop-notification.controller';
import { authenticate } from '@/middleware/auth';
import { superAdminAuth } from '@/middleware/super-admin-auth';

const router = Router();
const controller = new ShopNotificationAdminController();

router.use(authenticate);
router.use(superAdminAuth);

router.get('/', controller.getNotifications.bind(controller));
router.post('/', controller.createNotification.bind(controller));
router.post('/:id/send', controller.sendNotification.bind(controller));

export default router;
```

**File: `src/routes/shop-owner/staff.routes.ts`**

```typescript
import { Router } from 'express';
import { ShopStaffController } from '@/controllers/shop-owner/staff.controller';
import { authenticate } from '@/middleware/auth';
import { shopOwnerAuth } from '@/middleware/shop-owner-auth';

const router = Router();
const controller = new ShopStaffController();

router.use(authenticate);
router.use(shopOwnerAuth);

router.get('/', controller.getStaff.bind(controller));
router.get('/revenue', controller.getStaffRevenue.bind(controller));
router.get('/:id', controller.getStaffById.bind(controller));
router.post('/', controller.createStaff.bind(controller));
router.put('/:id', controller.updateStaff.bind(controller));
router.delete('/:id', controller.deleteStaff.bind(controller));

export default router;
```

**File: `src/routes/shop-owner/notification.routes.ts`**

```typescript
import { Router } from 'express';
import { ShopOwnerNotificationController } from '@/controllers/shop-owner/notification.controller';
import { authenticate } from '@/middleware/auth';
import { shopOwnerAuth } from '@/middleware/shop-owner-auth';

const router = Router();
const controller = new ShopOwnerNotificationController();

router.use(authenticate);
router.use(shopOwnerAuth);

router.get('/', controller.getNotifications.bind(controller));
router.post('/:id/read', controller.markAsRead.bind(controller));
router.post('/read-all', controller.markAllAsRead.bind(controller));

export default router;
```

---

## 3. Admin Panel Implementation

### 3.1 Shop Broadcast Page

**File: `src/app/dashboard/system/shop-broadcast/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Switch,
  Table,
  Tag,
  message,
  Modal,
  Space,
  Statistic,
  Row,
  Col,
  DatePicker,
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { adminApi } from '@/lib/api/admin';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

export default function ShopBroadcastPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['shop-notifications'],
    queryFn: () => adminApi.getShopNotifications(),
  });

  // Create notification mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createShopNotification(data),
    onSuccess: () => {
      message.success('공지가 발송되었습니다');
      setModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['shop-notifications'] });
    },
    onError: (error: any) => {
      message.error(error.message || '공지 발송에 실패했습니다');
    },
  });

  const handleSubmit = (values: any) => {
    createMutation.mutate({
      ...values,
      scheduledAt: values.scheduledAt?.toISOString(),
    });
  };

  const columns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '유형',
      dataIndex: 'notificationType',
      key: 'notificationType',
      width: 100,
      render: (type: string) => {
        const colors: Record<string, string> = {
          announcement: 'blue',
          update: 'green',
          alert: 'orange',
          promotion: 'purple',
        };
        const labels: Record<string, string> = {
          announcement: '공지',
          update: '업데이트',
          alert: '알림',
          promotion: '프로모션',
        };
        return <Tag color={colors[type]}>{labels[type] || type}</Tag>;
      },
    },
    {
      title: '대상',
      dataIndex: 'targetCategories',
      key: 'targetCategories',
      render: (categories: string[] | null) =>
        categories?.length ? categories.join(', ') : '전체 샵',
    },
    {
      title: '발송',
      dataIndex: 'sentAt',
      key: 'sentAt',
      width: 150,
      render: (date: string) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '예약됨',
    },
    {
      title: '수신/읽음',
      key: 'stats',
      width: 120,
      render: (_: any, record: any) => (
        <span>
          {record.deliveredCount || 0} / {record.readCount || 0}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">샵 공지 관리</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          새 공지 작성
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="총 공지"
              value={notificationsData?.total || 0}
              prefix={<BellOutlined />}
              suffix="건"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="이번 달"
              value={notificationsData?.notifications?.filter(
                (n: any) => dayjs(n.sentAt).month() === dayjs().month()
              ).length || 0}
              suffix="건"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="평균 읽음률"
              value={75}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Notifications Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={notificationsData?.notifications || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: notificationsData?.total || 0,
            pageSize: 20,
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="새 공지 작성"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            notificationType: 'announcement',
            priority: 'normal',
            sendPush: true,
            sendInApp: true,
          }}
        >
          <Form.Item
            name="title"
            label="제목"
            rules={[{ required: true, message: '제목을 입력해주세요' }]}
          >
            <Input placeholder="공지 제목" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="content"
            label="내용"
            rules={[{ required: true, message: '내용을 입력해주세요' }]}
          >
            <TextArea
              rows={4}
              placeholder="공지 내용을 입력하세요"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="notificationType" label="유형">
                <Select>
                  <Option value="announcement">공지</Option>
                  <Option value="update">업데이트</Option>
                  <Option value="alert">알림</Option>
                  <Option value="promotion">프로모션</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="우선순위">
                <Select>
                  <Option value="low">낮음</Option>
                  <Option value="normal">보통</Option>
                  <Option value="high">높음</Option>
                  <Option value="urgent">긴급</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="targetCategories" label="대상 카테고리">
            <Select
              mode="multiple"
              placeholder="전체 샵 (선택 안함)"
              allowClear
            >
              <Option value="nail">네일</Option>
              <Option value="hair">헤어</Option>
              <Option value="eyelash">속눈썹</Option>
              <Option value="waxing">왁싱</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sendPush" label="푸시 알림" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sendInApp" label="인앱 알림" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="scheduledAt" label="예약 발송 (선택)">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              placeholder="즉시 발송"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={createMutation.isPending}
              >
                발송하기
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

### 3.2 Staff Management Page

**File: `src/app/dashboard/my-shop/staff/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Avatar,
  Tag,
  Space,
  message,
  Statistic,
  Row,
  Col,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { shopOwnerApi } from '@/lib/api/shop-owner';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Staff {
  id: string;
  name: string;
  nickname?: string;
  role: string;
  phone?: string;
  email?: string;
  commissionRate: number;
  isActive: boolean;
  hireDate?: string;
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [form] = Form.useForm();

  // Fetch staff
  const { data: staffData, isLoading } = useQuery({
    queryKey: ['shop-staff'],
    queryFn: () => shopOwnerApi.getStaff({ includeInactive: true }),
  });

  // Fetch staff revenue
  const { data: revenueData } = useQuery({
    queryKey: ['staff-revenue'],
    queryFn: () => shopOwnerApi.getStaffRevenue(),
    enabled: activeTab === 'revenue',
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editingStaff
        ? shopOwnerApi.updateStaff(editingStaff.id, data)
        : shopOwnerApi.createStaff(data),
    onSuccess: () => {
      message.success(editingStaff ? '직원 정보가 수정되었습니다' : '직원이 등록되었습니다');
      setModalOpen(false);
      setEditingStaff(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['shop-staff'] });
    },
    onError: (error: any) => {
      message.error(error.message || '저장에 실패했습니다');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (staffId: string) => shopOwnerApi.deleteStaff(staffId),
    onSuccess: () => {
      message.success('직원이 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: ['shop-staff'] });
    },
    onError: (error: any) => {
      message.error(error.message || '삭제에 실패했습니다');
    },
  });

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    form.setFieldsValue({
      ...staff,
      hireDate: staff.hireDate ? dayjs(staff.hireDate) : undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = (staffId: string) => {
    Modal.confirm({
      title: '직원 삭제',
      content: '이 직원을 삭제하시겠습니까? 삭제된 직원은 비활성화 상태로 변경됩니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: () => deleteMutation.mutate(staffId),
    });
  };

  const handleSubmit = (values: any) => {
    saveMutation.mutate({
      ...values,
      hireDate: values.hireDate?.format('YYYY-MM-DD'),
    });
  };

  const staffColumns = [
    {
      title: '직원',
      key: 'name',
      render: (_: any, record: Staff) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{record.name}</div>
            {record.nickname && (
              <div className="text-xs text-gray-500">{record.nickname}</div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colors: Record<string, string> = {
          owner: 'gold',
          manager: 'blue',
          staff: 'default',
        };
        const labels: Record<string, string> = {
          owner: '대표',
          manager: '매니저',
          staff: '직원',
        };
        return <Tag color={colors[role]}>{labels[role] || role}</Tag>;
      },
    },
    {
      title: '연락처',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '커미션',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      render: (rate: number) => `${rate}%`,
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '활성' : '비활성'}
        </Tag>
      ),
    },
    {
      title: '관리',
      key: 'actions',
      width: 150,
      render: (_: any, record: Staff) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            삭제
          </Button>
        </Space>
      ),
    },
  ];

  const revenueColumns = [
    {
      title: '직원',
      dataIndex: 'staffName',
      key: 'staffName',
    },
    {
      title: '총 예약',
      dataIndex: 'totalReservations',
      key: 'totalReservations',
      render: (count: number) => `${count}건`,
    },
    {
      title: '완료',
      dataIndex: 'completedCount',
      key: 'completedCount',
      render: (count: number) => `${count}건`,
    },
    {
      title: '매출',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      render: (amount: number) => `₩${amount.toLocaleString()}`,
    },
    {
      title: '평균 평점',
      dataIndex: 'avgRating',
      key: 'avgRating',
      render: (rating: number) => rating?.toFixed(1) || '-',
    },
  ];

  const tabItems = [
    { key: 'list', label: '직원 목록' },
    { key: 'revenue', label: '직원별 매출' },
  ];

  const activeStaff = staffData?.staff?.filter((s: Staff) => s.isActive) || [];
  const totalRevenue = revenueData?.revenue?.reduce(
    (sum: number, r: any) => sum + (r.totalRevenue || 0), 0
  ) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">직원 관리</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingStaff(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          직원 등록
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="활성 직원"
              value={activeStaff.length}
              prefix={<UserOutlined />}
              suffix="명"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="전체 직원"
              value={staffData?.staff?.length || 0}
              suffix="명"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="이번 달 총 매출"
              value={totalRevenue}
              prefix={<DollarOutlined />}
              formatter={(value) => `₩${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
      </Row>

      {/* Content */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />

        {activeTab === 'list' && (
          <Table
            columns={staffColumns}
            dataSource={staffData?.staff || []}
            rowKey="id"
            loading={isLoading}
            pagination={false}
          />
        )}

        {activeTab === 'revenue' && (
          <Table
            columns={revenueColumns}
            dataSource={revenueData?.revenue || []}
            rowKey="staffId"
            pagination={false}
          />
        )}
      </Card>

      {/* Staff Modal */}
      <Modal
        title={editingStaff ? '직원 정보 수정' : '새 직원 등록'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingStaff(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            role: 'staff',
            commissionRate: 0,
          }}
        >
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="직원 이름" />
          </Form.Item>

          <Form.Item name="nickname" label="닉네임">
            <Input placeholder="표시 이름 (선택)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="역할">
                <Select>
                  <Option value="owner">대표</Option>
                  <Option value="manager">매니저</Option>
                  <Option value="staff">직원</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="commissionRate" label="커미션 (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="연락처">
                <Input placeholder="010-0000-0000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hireDate" label="입사일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="email" label="이메일">
            <Input placeholder="email@example.com" />
          </Form.Item>

          <Form.Item name="notes" label="메모">
            <TextArea rows={2} placeholder="직원 메모" />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setModalOpen(false)}>취소</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saveMutation.isPending}
              >
                {editingStaff ? '수정' : '등록'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

### 3.3 Shop Owner Notifications Page

**File: `src/app/dashboard/my-shop/notifications/page.tsx`**

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  List,
  Tag,
  Button,
  Badge,
  Empty,
  Spin,
  message,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { shopOwnerApi } from '@/lib/api/shop-owner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.locale('ko');

export default function ShopNotificationsPage() {
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data, isLoading } = useQuery({
    queryKey: ['shop-owner-notifications'],
    queryFn: () => shopOwnerApi.getNotifications(),
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => shopOwnerApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-owner-notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => shopOwnerApi.markAllNotificationsRead(),
    onSuccess: () => {
      message.success('모든 알림을 읽음 처리했습니다');
      queryClient.invalidateQueries({ queryKey: ['shop-owner-notifications'] });
    },
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'default',
      normal: 'blue',
      high: 'orange',
      urgent: 'red',
    };
    return colors[priority] || 'default';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      announcement: '공지',
      update: '업데이트',
      alert: '알림',
      promotion: '프로모션',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">공지사항</h1>
          {data?.unreadCount > 0 && (
            <Badge count={data.unreadCount} />
          )}
        </div>
        {data?.unreadCount > 0 && (
          <Button
            icon={<CheckOutlined />}
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
          >
            모두 읽음
          </Button>
        )}
      </div>

      <Card>
        {data?.notifications?.length > 0 ? (
          <List
            itemLayout="vertical"
            dataSource={data.notifications}
            renderItem={(item: any) => (
              <List.Item
                className={`cursor-pointer hover:bg-gray-50 ${
                  !item.isRead ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  if (!item.isRead) {
                    markReadMutation.mutate(item.id);
                  }
                }}
              >
                <List.Item.Meta
                  avatar={
                    <div className={`p-2 rounded-full ${
                      !item.isRead ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <BellOutlined className={
                        !item.isRead ? 'text-blue-500' : 'text-gray-400'
                      } />
                    </div>
                  }
                  title={
                    <div className="flex items-center gap-2">
                      <span className={!item.isRead ? 'font-bold' : ''}>
                        {item.title}
                      </span>
                      <Tag color={getPriorityColor(item.priority)}>
                        {getTypeLabel(item.type)}
                      </Tag>
                      {!item.isRead && (
                        <Badge status="processing" />
                      )}
                    </div>
                  }
                  description={
                    <span className="text-xs text-gray-500">
                      {dayjs(item.deliveredAt).fromNow()}
                    </span>
                  }
                />
                <div className="ml-12 text-gray-600">
                  {item.content}
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="공지사항이 없습니다" />
        )}
      </Card>
    </div>
  );
}
```

---

## 4. Files Summary

### New Files

**Backend:**
- `src/types/shop-notification.types.ts`
- `src/types/shop-staff.types.ts`
- `src/services/admin/shop-notification.service.ts`
- `src/services/shop-owner/staff.service.ts`
- `src/controllers/admin/shop-notification.controller.ts`
- `src/controllers/shop-owner/staff.controller.ts`
- `src/controllers/shop-owner/notification.controller.ts`
- `src/routes/admin/shop-notification.routes.ts`
- `src/routes/shop-owner/staff.routes.ts`
- `src/routes/shop-owner/notification.routes.ts`
- `src/migrations/010_add_shop_notifications_staff.sql`

**Admin Panel:**
- `src/app/dashboard/system/shop-broadcast/page.tsx`
- `src/app/dashboard/my-shop/staff/page.tsx`
- `src/app/dashboard/my-shop/notifications/page.tsx`

### Modified Files

**Backend:**
- `src/routes/admin/index.ts` (add shop notification routes)
- `src/routes/shop-owner/index.ts` (add staff and notification routes)

---

## 5. API Endpoints Summary

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/shop-notifications` | Get all shop notifications |
| POST | `/admin/shop-notifications` | Create shop notification |
| POST | `/admin/shop-notifications/:id/send` | Send scheduled notification |

### Shop Owner Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shop-owner/notifications` | Get shop notifications |
| POST | `/shop-owner/notifications/:id/read` | Mark notification as read |
| POST | `/shop-owner/notifications/read-all` | Mark all as read |
| GET | `/shop-owner/staff` | Get staff list |
| GET | `/shop-owner/staff/:id` | Get staff details |
| POST | `/shop-owner/staff` | Create staff member |
| PUT | `/shop-owner/staff/:id` | Update staff member |
| DELETE | `/shop-owner/staff/:id` | Delete (deactivate) staff |
| GET | `/shop-owner/staff/revenue` | Get staff revenue summary |

---

## 6. Testing Checklist

### Shop Notifications
- [ ] Super admin can create shop notification
- [ ] Notification is sent to all active shops
- [ ] Notification is sent only to target categories if specified
- [ ] Push notifications are delivered
- [ ] Shop owners see notifications in their dashboard
- [ ] Shop owners can mark notifications as read
- [ ] Unread count updates correctly
- [ ] Scheduled notifications work correctly

### Staff Management
- [ ] Shop owner can create staff member
- [ ] Shop owner can edit staff details
- [ ] Shop owner can deactivate staff
- [ ] Staff list shows active/inactive status
- [ ] Staff revenue summary calculates correctly
- [ ] Staff can be assigned to reservations
- [ ] Commission rates are stored correctly
