# Implementation Plan: SMS Notification Service

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 - Critical |
| **Estimated Effort** | 2-3 days |
| **Risk Level** | Medium |
| **Components Affected** | Backend |
| **Dependencies** | SMS Provider API credentials |

## Problem Statement

The current SMS service (`src/services/sms.service.ts`) is an empty stub that returns `true` without sending any messages. Users do not receive:
- Booking confirmation SMS
- OTP verification codes
- Payment reminders
- Cancellation notifications

This is critical for a Korean beauty platform where SMS is the primary communication channel.

---

## Recommended SMS Providers for Korea

| Provider | Pros | Cons | Pricing |
|----------|------|------|---------|
| **Kakao Alim Talk** | High delivery rate in Korea, Rich templates | Requires KakaoTalk business account | ~15-25 KRW/message |
| **NHN Cloud SMS** | Korean-focused, Good API | Less documentation in English | ~20-30 KRW/message |
| **Twilio** | Well-documented, Global | Higher cost for Korea | ~$0.07+ USD/message |
| **AWS SNS** | Reliable, Scalable | Complex setup | ~$0.00645 USD/message |

**Recommendation:** Use **Kakao Alim Talk** as primary (for template messages) with **NHN Cloud SMS** as fallback (for OTP).

---

## Database Schema Updates

### New Table: `sms_logs`

```sql
-- Migration: 20241217_create_sms_logs.sql

CREATE TYPE sms_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed',
  'expired'
);

CREATE TYPE sms_type AS ENUM (
  'otp',
  'booking_confirmation',
  'booking_reminder',
  'booking_cancelled',
  'payment_reminder',
  'payment_confirmation',
  'marketing',
  'system'
);

CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message_type sms_type NOT NULL,
  template_id VARCHAR(100),
  message_content TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'kakao_alimtalk',
  provider_message_id VARCHAR(255),
  status sms_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sms_logs_user_id ON sms_logs(user_id);
CREATE INDEX idx_sms_logs_phone_number ON sms_logs(phone_number);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
CREATE INDEX idx_sms_logs_message_type ON sms_logs(message_type);
CREATE INDEX idx_sms_logs_created_at ON sms_logs(created_at);
CREATE INDEX idx_sms_logs_provider_message_id ON sms_logs(provider_message_id);

-- RLS Policies
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admin can view all SMS logs" ON sms_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND user_role = 'admin'
    )
  );

-- Users can view their own logs
CREATE POLICY "Users can view own SMS logs" ON sms_logs
  FOR SELECT USING (user_id = auth.uid());
```

### New Table: `sms_templates`

```sql
-- Migration: 20241217_create_sms_templates.sql

CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(100) UNIQUE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  message_type sms_type NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'kakao_alimtalk',
  provider_template_id VARCHAR(255),
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  approval_status VARCHAR(50) DEFAULT 'pending',
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default templates
INSERT INTO sms_templates (template_code, template_name, message_type, template_content, variables) VALUES
('BOOKING_CONFIRMED', '예약 확정 알림', 'booking_confirmation',
 '[에뷰리띵] 예약이 확정되었습니다.\n\n샵: {{shop_name}}\n날짜: {{date}}\n시간: {{time}}\n서비스: {{service_name}}\n\n예약 확인: {{booking_url}}',
 '["shop_name", "date", "time", "service_name", "booking_url"]'),

('BOOKING_CANCELLED', '예약 취소 알림', 'booking_cancelled',
 '[에뷰리띵] 예약이 취소되었습니다.\n\n샵: {{shop_name}}\n날짜: {{date}}\n취소 사유: {{reason}}\n\n환불 안내: {{refund_info}}',
 '["shop_name", "date", "reason", "refund_info"]'),

('BOOKING_REMINDER', '예약 리마인더', 'booking_reminder',
 '[에뷰리띵] 예약 알림\n\n내일 {{time}}에 {{shop_name}} 예약이 있습니다.\n\n주소: {{address}}\n예약 확인: {{booking_url}}',
 '["time", "shop_name", "address", "booking_url"]'),

('OTP_VERIFICATION', '본인인증 OTP', 'otp',
 '[에뷰리띵] 인증번호: {{otp_code}}\n\n5분 내에 입력해주세요. 타인에게 공유하지 마세요.',
 '["otp_code"]'),

('PAYMENT_REMINDER', '결제 리마인더', 'payment_reminder',
 '[에뷰리띵] 잔금 결제 안내\n\n{{shop_name}} 예약의 잔금 {{amount}}원을 결제해주세요.\n\n결제 마감: {{due_date}}\n결제하기: {{payment_url}}',
 '["shop_name", "amount", "due_date", "payment_url"]'),

('PAYMENT_CONFIRMED', '결제 완료 알림', 'payment_confirmation',
 '[에뷰리띵] 결제가 완료되었습니다.\n\n결제 금액: {{amount}}원\n결제 수단: {{method}}\n\n영수증: {{receipt_url}}',
 '["amount", "method", "receipt_url"]');
```

---

## Type Definitions

### File: `src/types/sms.types.ts`

```typescript
/**
 * SMS Service Type Definitions
 * Consistent with database schema
 */

// Database ENUM types
export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';

export type SmsType =
  | 'otp'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'payment_reminder'
  | 'payment_confirmation'
  | 'marketing'
  | 'system';

// SMS Provider types
export type SmsProvider = 'kakao_alimtalk' | 'nhn_cloud' | 'twilio' | 'aws_sns';

// Template variable types
export interface SmsTemplateVariables {
  shop_name?: string;
  date?: string;
  time?: string;
  service_name?: string;
  booking_url?: string;
  reason?: string;
  refund_info?: string;
  address?: string;
  otp_code?: string;
  amount?: string;
  due_date?: string;
  payment_url?: string;
  method?: string;
  receipt_url?: string;
  customer_name?: string;
  [key: string]: string | undefined;
}

// SMS Log interface (matches database)
export interface SmsLog {
  id: string;
  user_id?: string;
  phone_number: string;
  message_type: SmsType;
  template_id?: string;
  message_content: string;
  provider: SmsProvider;
  provider_message_id?: string;
  status: SmsStatus;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  retry_count: number;
  max_retries: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// SMS Template interface (matches database)
export interface SmsTemplate {
  id: string;
  template_code: string;
  template_name: string;
  message_type: SmsType;
  provider: SmsProvider;
  provider_template_id?: string;
  template_content: string;
  variables: string[];
  is_active: boolean;
  approval_status: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// Request/Response interfaces
export interface SendSmsRequest {
  userId?: string;
  phoneNumber: string;
  templateCode: string;
  variables: SmsTemplateVariables;
  priority?: 'high' | 'normal' | 'low';
}

export interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  smsLogId?: string;
  provider?: SmsProvider;
  error?: {
    code: string;
    message: string;
  };
}

export interface SendOtpRequest {
  phoneNumber: string;
  userId?: string;
  purpose: 'registration' | 'login' | 'password_reset' | 'verification';
}

export interface SendOtpResponse {
  success: boolean;
  expiresAt?: string;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface VerifyOtpRequest {
  phoneNumber: string;
  otpCode: string;
  purpose: 'registration' | 'login' | 'password_reset' | 'verification';
}

export interface VerifyOtpResponse {
  success: boolean;
  verified: boolean;
  error?: {
    code: string;
    message: string;
  };
}

// Provider-specific interfaces
export interface KakaoAlimTalkConfig {
  apiKey: string;
  apiSecret: string;
  senderKey: string;
  templateCodes: Record<string, string>;
}

export interface NhnCloudSmsConfig {
  appKey: string;
  secretKey: string;
  sendNo: string;
}

// SMS Service configuration
export interface SmsServiceConfig {
  primaryProvider: SmsProvider;
  fallbackProvider?: SmsProvider;
  defaultRetryCount: number;
  otpExpiryMinutes: number;
  otpLength: number;
  rateLimitPerMinute: number;
  kakaoAlimTalk?: KakaoAlimTalkConfig;
  nhnCloud?: NhnCloudSmsConfig;
}
```

---

## Environment Configuration

### File: `src/config/environment.ts` (additions)

```typescript
// Add to envSchema
const envSchema = Joi.object({
  // ... existing config ...

  // SMS Configuration - Kakao Alim Talk
  KAKAO_ALIMTALK_API_KEY: Joi.string().optional(),
  KAKAO_ALIMTALK_API_SECRET: Joi.string().optional(),
  KAKAO_ALIMTALK_SENDER_KEY: Joi.string().optional(),
  KAKAO_ALIMTALK_PROFILE_KEY: Joi.string().optional(),

  // SMS Configuration - NHN Cloud (fallback)
  NHN_CLOUD_SMS_APP_KEY: Joi.string().optional(),
  NHN_CLOUD_SMS_SECRET_KEY: Joi.string().optional(),
  NHN_CLOUD_SMS_SEND_NO: Joi.string().optional(),

  // SMS General Settings
  SMS_PRIMARY_PROVIDER: Joi.string()
    .valid('kakao_alimtalk', 'nhn_cloud', 'twilio', 'aws_sns')
    .default('kakao_alimtalk'),
  SMS_FALLBACK_PROVIDER: Joi.string()
    .valid('kakao_alimtalk', 'nhn_cloud', 'twilio', 'aws_sns')
    .optional(),
  SMS_DEFAULT_RETRY_COUNT: Joi.number().default(3),
  SMS_OTP_EXPIRY_MINUTES: Joi.number().default(5),
  SMS_OTP_LENGTH: Joi.number().default(6),
  SMS_RATE_LIMIT_PER_MINUTE: Joi.number().default(5),
});

// Add to config export
export const config = {
  // ... existing config ...

  sms: {
    primaryProvider: envVars.SMS_PRIMARY_PROVIDER as SmsProvider,
    fallbackProvider: envVars.SMS_FALLBACK_PROVIDER as SmsProvider | undefined,
    defaultRetryCount: envVars.SMS_DEFAULT_RETRY_COUNT,
    otpExpiryMinutes: envVars.SMS_OTP_EXPIRY_MINUTES,
    otpLength: envVars.SMS_OTP_LENGTH,
    rateLimitPerMinute: envVars.SMS_RATE_LIMIT_PER_MINUTE,
    kakaoAlimTalk: {
      apiKey: envVars.KAKAO_ALIMTALK_API_KEY,
      apiSecret: envVars.KAKAO_ALIMTALK_API_SECRET,
      senderKey: envVars.KAKAO_ALIMTALK_SENDER_KEY,
      profileKey: envVars.KAKAO_ALIMTALK_PROFILE_KEY,
    },
    nhnCloud: {
      appKey: envVars.NHN_CLOUD_SMS_APP_KEY,
      secretKey: envVars.NHN_CLOUD_SMS_SECRET_KEY,
      sendNo: envVars.NHN_CLOUD_SMS_SEND_NO,
    },
  },
};
```

---

## SMS Service Implementation

### File: `src/services/sms.service.ts`

```typescript
/**
 * SMS Service Implementation
 * Supports multiple providers with automatic fallback
 */

import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
  SmsType,
  SmsStatus,
  SmsProvider,
  SmsLog,
  SmsTemplate,
  SmsTemplateVariables,
  SendSmsRequest,
  SendSmsResponse,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../types/sms.types';
import { KakaoAlimTalkProvider } from './providers/kakao-alimtalk.provider';
import { NhnCloudSmsProvider } from './providers/nhn-cloud-sms.provider';

// OTP storage (in production, use Redis)
interface OtpRecord {
  code: string;
  expiresAt: Date;
  attempts: number;
  purpose: string;
}

export class SmsService {
  private supabase = getSupabaseClient();
  private kakaoProvider: KakaoAlimTalkProvider;
  private nhnProvider: NhnCloudSmsProvider;
  private otpStore: Map<string, OtpRecord> = new Map();

  constructor() {
    this.kakaoProvider = new KakaoAlimTalkProvider(config.sms.kakaoAlimTalk);
    this.nhnProvider = new NhnCloudSmsProvider(config.sms.nhnCloud);
  }

  /**
   * Send SMS using template
   */
  async sendTemplateSms(request: SendSmsRequest): Promise<SendSmsResponse> {
    const { userId, phoneNumber, templateCode, variables, priority = 'normal' } = request;

    try {
      // 1. Get template
      const template = await this.getTemplate(templateCode);
      if (!template) {
        return {
          success: false,
          error: { code: 'TEMPLATE_NOT_FOUND', message: `Template ${templateCode} not found` },
        };
      }

      // 2. Render message content
      const messageContent = this.renderTemplate(template.template_content, variables);

      // 3. Create SMS log record
      const smsLog = await this.createSmsLog({
        userId,
        phoneNumber: this.normalizePhoneNumber(phoneNumber),
        messageType: template.message_type,
        templateId: template.id,
        messageContent,
        provider: config.sms.primaryProvider,
      });

      // 4. Send via primary provider
      let result = await this.sendViaProvider(
        config.sms.primaryProvider,
        phoneNumber,
        messageContent,
        template
      );

      // 5. If failed and fallback available, try fallback
      if (!result.success && config.sms.fallbackProvider) {
        logger.warn('Primary SMS provider failed, trying fallback', {
          primary: config.sms.primaryProvider,
          fallback: config.sms.fallbackProvider,
          error: result.error,
        });

        result = await this.sendViaProvider(
          config.sms.fallbackProvider,
          phoneNumber,
          messageContent,
          template
        );

        if (result.success) {
          await this.updateSmsLog(smsLog.id, {
            provider: config.sms.fallbackProvider,
          });
        }
      }

      // 6. Update SMS log with result
      await this.updateSmsLog(smsLog.id, {
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.messageId,
        sentAt: result.success ? new Date().toISOString() : undefined,
        failedAt: !result.success ? new Date().toISOString() : undefined,
        failureReason: result.error?.message,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        smsLogId: smsLog.id,
        provider: result.success ? config.sms.primaryProvider : undefined,
        error: result.error,
      };
    } catch (error) {
      logger.error('SMS send failed', { error, request });
      return {
        success: false,
        error: {
          code: 'SMS_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Send OTP verification code
   */
  async sendOtp(request: SendOtpRequest): Promise<SendOtpResponse> {
    const { phoneNumber, userId, purpose } = request;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      // 1. Rate limit check
      const recentOtps = await this.getRecentOtpCount(normalizedPhone);
      if (recentOtps >= config.sms.rateLimitPerMinute) {
        return {
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many OTP requests' },
        };
      }

      // 2. Generate OTP
      const otpCode = this.generateOtp();
      const expiresAt = new Date(Date.now() + config.sms.otpExpiryMinutes * 60 * 1000);

      // 3. Store OTP
      this.otpStore.set(`${normalizedPhone}:${purpose}`, {
        code: otpCode,
        expiresAt,
        attempts: 0,
        purpose,
      });

      // 4. Send OTP SMS
      const result = await this.sendTemplateSms({
        userId,
        phoneNumber: normalizedPhone,
        templateCode: 'OTP_VERIFICATION',
        variables: { otp_code: otpCode },
        priority: 'high',
      });

      if (!result.success) {
        // Clean up stored OTP on failure
        this.otpStore.delete(`${normalizedPhone}:${purpose}`);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        expiresAt: expiresAt.toISOString(),
        messageId: result.messageId,
      };
    } catch (error) {
      logger.error('OTP send failed', { error, request });
      return {
        success: false,
        error: {
          code: 'OTP_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const { phoneNumber, otpCode, purpose } = request;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const key = `${normalizedPhone}:${purpose}`;

    try {
      const record = this.otpStore.get(key);

      if (!record) {
        return {
          success: true,
          verified: false,
          error: { code: 'OTP_NOT_FOUND', message: 'OTP not found or expired' },
        };
      }

      // Check expiry
      if (new Date() > record.expiresAt) {
        this.otpStore.delete(key);
        return {
          success: true,
          verified: false,
          error: { code: 'OTP_EXPIRED', message: 'OTP has expired' },
        };
      }

      // Check attempts
      if (record.attempts >= 5) {
        this.otpStore.delete(key);
        return {
          success: true,
          verified: false,
          error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many verification attempts' },
        };
      }

      // Verify code
      if (record.code !== otpCode) {
        record.attempts++;
        return {
          success: true,
          verified: false,
          error: { code: 'INVALID_OTP', message: 'Invalid OTP code' },
        };
      }

      // Success - delete OTP
      this.otpStore.delete(key);

      return {
        success: true,
        verified: true,
      };
    } catch (error) {
      logger.error('OTP verification failed', { error, request });
      return {
        success: false,
        verified: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Send booking confirmation SMS
   */
  async sendBookingConfirmation(
    userId: string,
    phoneNumber: string,
    bookingDetails: {
      shopName: string;
      date: string;
      time: string;
      serviceName: string;
      bookingId: string;
    }
  ): Promise<SendSmsResponse> {
    return this.sendTemplateSms({
      userId,
      phoneNumber,
      templateCode: 'BOOKING_CONFIRMED',
      variables: {
        shop_name: bookingDetails.shopName,
        date: bookingDetails.date,
        time: bookingDetails.time,
        service_name: bookingDetails.serviceName,
        booking_url: `https://e-beautything.com/bookings/${bookingDetails.bookingId}`,
      },
    });
  }

  /**
   * Send booking cancellation SMS
   */
  async sendBookingCancellation(
    userId: string,
    phoneNumber: string,
    details: {
      shopName: string;
      date: string;
      reason: string;
      refundInfo: string;
    }
  ): Promise<SendSmsResponse> {
    return this.sendTemplateSms({
      userId,
      phoneNumber,
      templateCode: 'BOOKING_CANCELLED',
      variables: {
        shop_name: details.shopName,
        date: details.date,
        reason: details.reason,
        refund_info: details.refundInfo,
      },
    });
  }

  /**
   * Send payment reminder SMS
   */
  async sendPaymentReminder(
    userId: string,
    phoneNumber: string,
    details: {
      shopName: string;
      amount: number;
      dueDate: string;
      reservationId: string;
    }
  ): Promise<SendSmsResponse> {
    return this.sendTemplateSms({
      userId,
      phoneNumber,
      templateCode: 'PAYMENT_REMINDER',
      variables: {
        shop_name: details.shopName,
        amount: details.amount.toLocaleString('ko-KR'),
        due_date: details.dueDate,
        payment_url: `https://e-beautything.com/payment/${details.reservationId}`,
      },
    });
  }

  // === Private Helper Methods ===

  private async getTemplate(templateCode: string): Promise<SmsTemplate | null> {
    const { data, error } = await this.supabase
      .from('sms_templates')
      .select('*')
      .eq('template_code', templateCode)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      logger.warn('SMS template not found', { templateCode, error });
      return null;
    }

    return data as SmsTemplate;
  }

  private renderTemplate(template: string, variables: SmsTemplateVariables): string {
    let content = template;
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
    return content;
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let normalized = phone.replace(/\D/g, '');

    // Handle Korean phone numbers
    if (normalized.startsWith('82')) {
      normalized = '0' + normalized.substring(2);
    } else if (!normalized.startsWith('0')) {
      normalized = '0' + normalized;
    }

    return normalized;
  }

  private generateOtp(): string {
    const length = config.sms.otpLength;
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  private async createSmsLog(data: Partial<SmsLog>): Promise<SmsLog> {
    const { data: log, error } = await this.supabase
      .from('sms_logs')
      .insert({
        user_id: data.userId,
        phone_number: data.phoneNumber,
        message_type: data.messageType,
        template_id: data.templateId,
        message_content: data.messageContent,
        provider: data.provider,
        status: 'pending',
        retry_count: 0,
        max_retries: config.sms.defaultRetryCount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create SMS log: ${error.message}`);
    }

    return log as SmsLog;
  }

  private async updateSmsLog(id: string, updates: Partial<SmsLog>): Promise<void> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status) updateData.status = updates.status;
    if (updates.providerMessageId) updateData.provider_message_id = updates.providerMessageId;
    if (updates.sentAt) updateData.sent_at = updates.sentAt;
    if (updates.failedAt) updateData.failed_at = updates.failedAt;
    if (updates.failureReason) updateData.failure_reason = updates.failureReason;
    if (updates.provider) updateData.provider = updates.provider;

    const { error } = await this.supabase
      .from('sms_logs')
      .update(updateData)
      .eq('id', id);

    if (error) {
      logger.error('Failed to update SMS log', { id, error });
    }
  }

  private async sendViaProvider(
    provider: SmsProvider,
    phoneNumber: string,
    message: string,
    template: SmsTemplate
  ): Promise<{ success: boolean; messageId?: string; error?: { code: string; message: string } }> {
    switch (provider) {
      case 'kakao_alimtalk':
        return this.kakaoProvider.send(phoneNumber, message, template.provider_template_id);
      case 'nhn_cloud':
        return this.nhnProvider.send(phoneNumber, message);
      default:
        return {
          success: false,
          error: { code: 'UNSUPPORTED_PROVIDER', message: `Provider ${provider} not supported` },
        };
    }
  }

  private async getRecentOtpCount(phoneNumber: string): Promise<number> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { count, error } = await this.supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('phone_number', phoneNumber)
      .eq('message_type', 'otp')
      .gte('created_at', oneMinuteAgo);

    if (error) {
      logger.error('Failed to get OTP count', { error });
      return 0;
    }

    return count || 0;
  }
}

// Export singleton instance
export const smsService = new SmsService();
```

---

## SMS Provider Implementations

### File: `src/services/providers/kakao-alimtalk.provider.ts`

```typescript
/**
 * Kakao Alim Talk SMS Provider
 * Official documentation: https://developers.kakao.com/docs/latest/ko/message/rest-api
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { KakaoAlimTalkConfig } from '../../types/sms.types';

export class KakaoAlimTalkProvider {
  private client: AxiosInstance;
  private config: KakaoAlimTalkConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: KakaoAlimTalkConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://kapi.kakao.com',
      timeout: 10000,
    });
  }

  async send(
    phoneNumber: string,
    message: string,
    templateId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: { code: string; message: string } }> {
    try {
      // Check if configured
      if (!this.config.apiKey || !this.config.senderKey) {
        logger.warn('Kakao Alim Talk not configured, using mock mode');
        return this.mockSend(phoneNumber, message);
      }

      // Get access token
      const accessToken = await this.getAccessToken();

      // Format phone number for Kakao (without leading 0, with +82)
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Send message
      const response = await this.client.post(
        '/v2/api/talk/memo/default/send',
        {
          template_object: {
            object_type: 'text',
            text: message,
            link: {
              web_url: 'https://e-beautything.com',
              mobile_web_url: 'https://e-beautything.com',
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        success: true,
        messageId: response.data.result_code?.toString() || 'kakao_' + Date.now(),
      };
    } catch (error) {
      logger.error('Kakao Alim Talk send failed', { error, phoneNumber });

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: {
            code: error.response?.data?.error_code || 'KAKAO_ERROR',
            message: error.response?.data?.error_message || error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'KAKAO_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Get new token
    const response = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.apiKey,
        client_secret: this.config.apiSecret,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in - 60) * 1000);

    return this.accessToken;
  }

  private formatPhoneNumber(phone: string): string {
    // Remove leading 0 and add +82 for Korean numbers
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '+82' + cleaned.substring(1);
    }
    return '+' + cleaned;
  }

  private mockSend(
    phoneNumber: string,
    message: string
  ): { success: boolean; messageId?: string } {
    logger.info('[MOCK] Kakao Alim Talk SMS', {
      to: phoneNumber,
      message: message.substring(0, 50) + '...',
    });
    return {
      success: true,
      messageId: 'mock_kakao_' + Date.now(),
    };
  }
}
```

### File: `src/services/providers/nhn-cloud-sms.provider.ts`

```typescript
/**
 * NHN Cloud SMS Provider (fallback)
 * Documentation: https://docs.nhncloud.com/ko/Notification/SMS/ko/api-guide/
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { NhnCloudSmsConfig } from '../../types/sms.types';

export class NhnCloudSmsProvider {
  private client: AxiosInstance;
  private config: NhnCloudSmsConfig;

  constructor(config: NhnCloudSmsConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api-sms.cloud.toast.com',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': config.secretKey,
      },
    });
  }

  async send(
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: { code: string; message: string } }> {
    try {
      // Check if configured
      if (!this.config.appKey || !this.config.sendNo) {
        logger.warn('NHN Cloud SMS not configured, using mock mode');
        return this.mockSend(phoneNumber, message);
      }

      const response = await this.client.post(
        `/sms/v3.0/appKeys/${this.config.appKey}/sender/sms`,
        {
          body: message,
          sendNo: this.config.sendNo,
          recipientList: [
            {
              recipientNo: phoneNumber.replace(/\D/g, ''),
            },
          ],
        }
      );

      if (response.data.header.isSuccessful) {
        return {
          success: true,
          messageId: response.data.body.data.requestId,
        };
      }

      return {
        success: false,
        error: {
          code: response.data.header.resultCode?.toString() || 'NHN_ERROR',
          message: response.data.header.resultMessage || 'NHN Cloud SMS failed',
        },
      };
    } catch (error) {
      logger.error('NHN Cloud SMS send failed', { error, phoneNumber });

      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: {
            code: error.response?.data?.header?.resultCode || 'NHN_ERROR',
            message: error.response?.data?.header?.resultMessage || error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'NHN_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private mockSend(
    phoneNumber: string,
    message: string
  ): { success: boolean; messageId?: string } {
    logger.info('[MOCK] NHN Cloud SMS', {
      to: phoneNumber,
      message: message.substring(0, 50) + '...',
    });
    return {
      success: true,
      messageId: 'mock_nhn_' + Date.now(),
    };
  }
}
```

---

## Integration with Reservation Service

### Update `src/services/reservation.service.ts`

```typescript
import { smsService } from './sms.service';

// Add to existing ReservationService class:

/**
 * Send booking confirmation SMS after successful reservation
 */
private async sendBookingConfirmationSms(reservation: Reservation, shop: Shop, services: ShopService[]): Promise<void> {
  try {
    // Get user phone number
    const { data: user } = await this.supabase
      .from('users')
      .select('phone_number, name')
      .eq('id', reservation.user_id)
      .single();

    if (!user?.phone_number) {
      logger.warn('User has no phone number, skipping SMS', { userId: reservation.user_id });
      return;
    }

    // Get notification settings
    const { data: settings } = await this.supabase
      .from('user_settings')
      .select('reservation_notifications')
      .eq('user_id', reservation.user_id)
      .single();

    if (settings?.reservation_notifications === false) {
      logger.info('User has disabled reservation SMS notifications', { userId: reservation.user_id });
      return;
    }

    // Format date and time
    const date = new Date(reservation.reservation_date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    const time = reservation.reservation_time;

    // Send SMS
    const result = await smsService.sendBookingConfirmation(
      reservation.user_id,
      user.phone_number,
      {
        shopName: shop.name,
        date,
        time,
        serviceName: services.map(s => s.name).join(', '),
        bookingId: reservation.id,
      }
    );

    if (!result.success) {
      logger.error('Failed to send booking confirmation SMS', {
        reservationId: reservation.id,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error sending booking confirmation SMS', { error, reservationId: reservation.id });
  }
}

// Call in confirmReservation method:
// After reservation is confirmed, add:
await this.sendBookingConfirmationSms(reservation, shop, services);
```

---

## API Endpoints

### File: `src/routes/sms.routes.ts`

```typescript
import { Router } from 'express';
import { SmsController } from '../controllers/sms.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';

const router = Router();
const smsController = new SmsController();

// OTP endpoints (public with rate limiting)
router.post(
  '/otp/send',
  rateLimitMiddleware({ windowMs: 60000, max: 5 }),
  smsController.sendOtp
);

router.post(
  '/otp/verify',
  rateLimitMiddleware({ windowMs: 60000, max: 10 }),
  smsController.verifyOtp
);

// Admin endpoints
router.get(
  '/logs',
  authMiddleware,
  // adminMiddleware,
  smsController.getLogs
);

router.get(
  '/templates',
  authMiddleware,
  // adminMiddleware,
  smsController.getTemplates
);

export default router;
```

### File: `src/controllers/sms.controller.ts`

```typescript
import { Request, Response } from 'express';
import { smsService } from '../services/sms.service';
import { logger } from '../utils/logger';

export class SmsController {
  async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, purpose } = req.body;

      if (!phoneNumber || !purpose) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Phone number and purpose are required' },
        });
        return;
      }

      const result = await smsService.sendOtp({
        phoneNumber,
        purpose,
      });

      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Send OTP error', { error });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to send OTP' },
      });
    }
  }

  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, otpCode, purpose } = req.body;

      if (!phoneNumber || !otpCode || !purpose) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Phone number, OTP code, and purpose are required' },
        });
        return;
      }

      const result = await smsService.verifyOtp({
        phoneNumber,
        otpCode,
        purpose,
      });

      res.status(200).json(result);
    } catch (error) {
      logger.error('Verify OTP error', { error });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to verify OTP' },
      });
    }
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    // Implementation for admin
    res.status(501).json({ message: 'Not implemented' });
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    // Implementation for admin
    res.status(501).json({ message: 'Not implemented' });
  }
}
```

---

## Testing Plan

### Unit Tests

**File:** `tests/unit/services/sms.service.test.ts`

```typescript
import { SmsService } from '../../../src/services/sms.service';

describe('SmsService', () => {
  let smsService: SmsService;

  beforeEach(() => {
    smsService = new SmsService();
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize Korean phone numbers', () => {
      // Test cases
      expect(smsService['normalizePhoneNumber']('010-1234-5678')).toBe('01012345678');
      expect(smsService['normalizePhoneNumber']('+82-10-1234-5678')).toBe('01012345678');
      expect(smsService['normalizePhoneNumber']('821012345678')).toBe('01012345678');
    });
  });

  describe('generateOtp', () => {
    it('should generate OTP of correct length', () => {
      const otp = smsService['generateOtp']();
      expect(otp).toHaveLength(6);
      expect(/^\d+$/.test(otp)).toBe(true);
    });
  });

  describe('renderTemplate', () => {
    it('should replace all variables', () => {
      const template = '안녕하세요 {{name}}님, {{date}}에 예약이 있습니다.';
      const result = smsService['renderTemplate'](template, {
        name: '홍길동',
        date: '2024년 12월 25일',
      });
      expect(result).toBe('안녕하세요 홍길동님, 2024년 12월 25일에 예약이 있습니다.');
    });
  });

  describe('sendOtp', () => {
    it('should rate limit excessive requests', async () => {
      // Send multiple OTPs
      for (let i = 0; i < 6; i++) {
        await smsService.sendOtp({
          phoneNumber: '01012345678',
          purpose: 'verification',
        });
      }

      const result = await smsService.sendOtp({
        phoneNumber: '01012345678',
        purpose: 'verification',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('verifyOtp', () => {
    it('should verify correct OTP', async () => {
      // First send OTP
      await smsService.sendOtp({
        phoneNumber: '01012345678',
        purpose: 'test',
      });

      // Get the stored OTP (normally you wouldn't do this)
      const storedOtp = smsService['otpStore'].get('01012345678:test');

      const result = await smsService.verifyOtp({
        phoneNumber: '01012345678',
        otpCode: storedOtp!.code,
        purpose: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('should reject invalid OTP', async () => {
      await smsService.sendOtp({
        phoneNumber: '01012345678',
        purpose: 'test',
      });

      const result = await smsService.verifyOtp({
        phoneNumber: '01012345678',
        otpCode: '000000',
        purpose: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('INVALID_OTP');
    });
  });
});
```

---

## Deployment Checklist

- [ ] Run database migrations for `sms_logs` and `sms_templates` tables
- [ ] Add environment variables for SMS providers
- [ ] Create `src/types/sms.types.ts`
- [ ] Update `src/config/environment.ts`
- [ ] Implement `src/services/sms.service.ts`
- [ ] Implement `src/services/providers/kakao-alimtalk.provider.ts`
- [ ] Implement `src/services/providers/nhn-cloud-sms.provider.ts`
- [ ] Create `src/controllers/sms.controller.ts`
- [ ] Create `src/routes/sms.routes.ts`
- [ ] Mount SMS routes in `src/app.ts`
- [ ] Integrate SMS into reservation service
- [ ] Write unit tests
- [ ] Test in development with mock mode
- [ ] Configure Kakao Alim Talk business account
- [ ] Submit template approval to Kakao
- [ ] Deploy to staging
- [ ] Test actual SMS delivery
- [ ] Deploy to production

---

## Environment Variables Required

```bash
# SMS Configuration - Kakao Alim Talk (Primary)
KAKAO_ALIMTALK_API_KEY=your_api_key
KAKAO_ALIMTALK_API_SECRET=your_api_secret
KAKAO_ALIMTALK_SENDER_KEY=your_sender_key
KAKAO_ALIMTALK_PROFILE_KEY=your_profile_key

# SMS Configuration - NHN Cloud (Fallback)
NHN_CLOUD_SMS_APP_KEY=your_app_key
NHN_CLOUD_SMS_SECRET_KEY=your_secret_key
NHN_CLOUD_SMS_SEND_NO=0212345678

# SMS General Settings
SMS_PRIMARY_PROVIDER=kakao_alimtalk
SMS_FALLBACK_PROVIDER=nhn_cloud
SMS_DEFAULT_RETRY_COUNT=3
SMS_OTP_EXPIRY_MINUTES=5
SMS_OTP_LENGTH=6
SMS_RATE_LIMIT_PER_MINUTE=5

# Development Mode
MOCK_SMS=true  # Set to false in production
```

---

## Timeline

| Task | Duration |
|------|----------|
| Database migrations | 1 hour |
| Type definitions | 1 hour |
| SMS Service implementation | 4 hours |
| Provider implementations | 3 hours |
| API endpoints | 2 hours |
| Integration with reservation | 2 hours |
| Unit tests | 2 hours |
| Testing & debugging | 4 hours |
| Kakao template approval | 1-3 days (external) |
| **Total Development** | **~20 hours** |
