export type ShopNotificationType = 'announcement' | 'update' | 'alert' | 'promotion';
export type ShopNotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ShopNotification {
  id: string;
  title: string;
  content: string;
  notificationType: ShopNotificationType;
  priority: ShopNotificationPriority;
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
  notificationType?: ShopNotificationType;
  priority?: ShopNotificationPriority;
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

export interface ShopOwnerNotification {
  id: string;
  notificationId: string;
  title: string;
  content: string;
  type: ShopNotificationType;
  priority: ShopNotificationPriority;
  deliveredAt: Date;
  readAt?: Date;
  isRead: boolean;
}
