export interface ModerationAction {
  id: string;
  shop_id: string;
  action_type: 'approve' | 'reject' | 'warning' | 'auto_block' | 'auto_flag' | 'manual_review';
  reason: string;
  admin_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ModerationRule {
  id: string;
  name: string;
  description: string;
  rule_type: 'content' | 'behavior' | 'automated';
  conditions: Record<string, any>;
  actions: string[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ModerationReport {
  id: string;
  shop_id: string;
  reporter_id: string;
  report_type: 'inappropriate_content' | 'spam' | 'fraud' | 'other';
  description: string;
  evidence?: string[];
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ModerationQueue {
  id: string;
  shop_id: string;
  item_type: 'shop' | 'review' | 'image' | 'content';
  item_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'completed';
  assigned_admin_id?: string;
  created_at: string;
  updated_at: string;
}
