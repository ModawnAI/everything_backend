# Implementation Plan: Email Notification Service

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 8-12 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend only |
| **Dependencies** | AWS SES or SendGrid account |

## Problem Statement

The email service (`src/services/email.service.ts`) is an empty stub that always returns `true` without sending actual emails:

```typescript
// Current Implementation - src/services/email.service.ts
export class EmailService {
  async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    // Implementation would go here
    return true;
  }

  async sendTemplateEmail(to: string, templateId: string, data: any): Promise<boolean> {
    // Implementation would go here
    return true;
  }
}
```

**Impact:**
1. Password reset functionality doesn't work
2. Booking confirmations not delivered via email
3. Marketing emails not sent
4. Account verification emails not delivered
5. Shop approval notifications not sent to owners
6. No email audit trail

---

## Recommended Provider: AWS SES

For a Korean beauty platform, AWS SES is recommended due to:
- **Cost-effective**: $0.10 per 1,000 emails
- **High deliverability**: Strong reputation management
- **Korean region support**: ap-northeast-2 (Seoul)
- **Integration**: Easy Node.js SDK integration
- **Compliance**: GDPR and Korean PIPA compliant

### Alternative: SendGrid
- Better for marketing-heavy use cases
- Built-in template editor
- Higher cost but more features

---

## Files Requiring Changes

### New Files to Create

| File | Purpose |
|------|---------|
| `src/services/email.service.ts` | Complete rewrite with AWS SES |
| `src/services/email-template.service.ts` | Email template management |
| `src/types/email.types.ts` | Email type definitions |
| `src/templates/emails/` | HTML email templates |
| `tests/unit/services/email.service.test.ts` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/config/environment.ts` | Add AWS SES configuration |
| `src/services/notification.service.ts` | Integrate email sending |
| `package.json` | Add `@aws-sdk/client-ses` |

---

## Implementation Steps

### Step 1: Define Email Types

**File:** `src/types/email.types.ts`

```typescript
/**
 * Email type definitions for eBeautything platform
 * Consistent with database.types.ts naming conventions
 */

// Email status enum (matches database pattern)
export type EmailStatus = 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'complained';

// Email priority levels
export type EmailPriority = 'low' | 'medium' | 'high' | 'critical';

// Email category types
export type EmailCategory =
  | 'transactional'     // Booking confirmations, receipts
  | 'notification'      // Status updates, reminders
  | 'authentication'    // Password reset, verification
  | 'marketing'         // Promotions, newsletters
  | 'system';           // Admin notifications, alerts

// Email template identifiers
export type EmailTemplateId =
  // Authentication
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'new_device_login'
  // Reservations
  | 'reservation_requested'
  | 'reservation_confirmed'
  | 'reservation_rejected'
  | 'reservation_cancelled_by_user'
  | 'reservation_cancelled_by_shop'
  | 'reservation_reminder'
  | 'reservation_completed'
  | 'reservation_no_show'
  // Payments
  | 'payment_received'
  | 'payment_failed'
  | 'refund_processed'
  | 'deposit_reminder'
  // Shop Management
  | 'shop_approved'
  | 'shop_rejected'
  | 'shop_verification_pending'
  | 'shop_documents_required'
  // User Management
  | 'welcome'
  | 'account_suspended'
  | 'account_reactivated'
  | 'role_upgraded'
  | 'data_export_ready'
  | 'account_deletion_scheduled'
  // Points & Referrals
  | 'points_earned'
  | 'points_expiring'
  | 'referral_success'
  | 'influencer_qualified';

// Base email interface
export interface EmailPayload {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  templateId?: EmailTemplateId;
  templateData?: Record<string, unknown>;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  category: EmailCategory;
  priority: EmailPriority;
  metadata?: Record<string, unknown>;
}

// Email attachment
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  encoding?: 'base64' | 'utf-8';
}

// Email send result
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

// Email log entry for database
export interface EmailLog {
  id: string;
  userId?: string;
  recipientEmail: string;
  templateId?: EmailTemplateId;
  subject: string;
  category: EmailCategory;
  priority: EmailPriority;
  status: EmailStatus;
  messageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  sentAt?: string;
  deliveredAt?: string;
  bouncedAt?: string;
  createdAt: string;
}

// Template context for each email type
export interface ReservationEmailData {
  userName: string;
  shopName: string;
  serviceName: string;
  reservationDate: string;
  reservationTime: string;
  totalAmount: number;
  depositAmount?: number;
  reservationId: string;
  shopAddress?: string;
  shopPhone?: string;
  cancellationReason?: string;
  refundAmount?: number;
}

export interface AuthenticationEmailData {
  userName: string;
  verificationLink?: string;
  resetLink?: string;
  expiresIn?: string;
  deviceInfo?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface PaymentEmailData {
  userName: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string;
  refundAmount?: number;
  refundReason?: string;
}

export interface ShopEmailData {
  ownerName: string;
  shopName: string;
  rejectionReason?: string;
  documentsRequired?: string[];
  approvalDate?: string;
}

export interface PointsEmailData {
  userName: string;
  pointsAmount: number;
  pointsBalance: number;
  expiryDate?: string;
  transactionType: string;
}

// AWS SES specific types
export interface SESConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  senderEmail: string;
  senderName: string;
  replyToEmail?: string;
  configurationSet?: string;
}

// Email provider interface (for multiple provider support)
export interface IEmailProvider {
  sendEmail(payload: EmailPayload): Promise<EmailSendResult>;
  sendBulkEmail(payloads: EmailPayload[]): Promise<EmailSendResult[]>;
  verifyEmail(email: string): Promise<boolean>;
}

export default {
  EmailStatus,
  EmailPriority,
  EmailCategory,
  EmailTemplateId,
};
```

### Step 2: Update Environment Configuration

**File:** `src/config/environment.ts`

Add to Joi schema:

```typescript
// Add to envVarsSchema
AWS_SES_REGION: Joi.string().default('ap-northeast-2'),
AWS_SES_ACCESS_KEY_ID: Joi.string().optional(),
AWS_SES_SECRET_ACCESS_KEY: Joi.string().optional(),
AWS_SES_SENDER_EMAIL: Joi.string().email().optional(),
AWS_SES_SENDER_NAME: Joi.string().default('eBeautything'),
AWS_SES_REPLY_TO_EMAIL: Joi.string().email().optional(),
AWS_SES_CONFIGURATION_SET: Joi.string().optional(),
MOCK_EMAIL: Joi.boolean().default(true),
EMAIL_DEBUG_MODE: Joi.boolean().default(false),

// Add to config export
aws: {
  ses: {
    region: envVars.AWS_SES_REGION,
    accessKeyId: envVars.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SES_SECRET_ACCESS_KEY,
    senderEmail: envVars.AWS_SES_SENDER_EMAIL,
    senderName: envVars.AWS_SES_SENDER_NAME,
    replyToEmail: envVars.AWS_SES_REPLY_TO_EMAIL || envVars.AWS_SES_SENDER_EMAIL,
    configurationSet: envVars.AWS_SES_CONFIGURATION_SET,
  }
},
mockEmail: envVars.MOCK_EMAIL,
emailDebugMode: envVars.EMAIL_DEBUG_MODE,
```

### Step 3: Install Dependencies

```bash
npm install @aws-sdk/client-ses @aws-sdk/client-sesv2 handlebars mjml juice
npm install -D @types/mjml
```

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-ses` | AWS SES SDK v3 |
| `@aws-sdk/client-sesv2` | AWS SES v2 API (for templates) |
| `handlebars` | Template variable substitution |
| `mjml` | Responsive email framework |
| `juice` | Inline CSS for email compatibility |

### Step 4: Implement Email Template Service

**File:** `src/services/email-template.service.ts`

```typescript
/**
 * Email Template Service
 * Manages email template rendering with Korean language support
 */

import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import juice from 'juice';
import { logger } from '../utils/logger';
import {
  EmailTemplateId,
  ReservationEmailData,
  AuthenticationEmailData,
  PaymentEmailData,
  ShopEmailData,
  PointsEmailData,
} from '../types/email.types';

// Register Handlebars helpers
Handlebars.registerHelper('formatCurrency', (amount: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
});

Handlebars.registerHelper('formatDate', (dateStr: string) => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
});

Handlebars.registerHelper('formatTime', (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? '오후' : '오전';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${period} ${displayHour}:${minutes}`;
});

// Email template definitions (Korean)
const EMAIL_TEMPLATES: Record<EmailTemplateId, { subject: string; mjml: string }> = {
  // Authentication Templates
  email_verification: {
    subject: '[에뷰리띵] 이메일 인증을 완료해주세요',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
    <mj-style>
      .button { background-color: #FF6B9D !important; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          안녕하세요, {{userName}}님!
        </mj-text>
        <mj-text>
          에뷰리띵에 가입해 주셔서 감사합니다.<br/>
          아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
        </mj-text>
        <mj-button href="{{verificationLink}}" background-color="#FF6B9D" color="#ffffff" font-size="16px" padding="20px 0">
          이메일 인증하기
        </mj-button>
        <mj-text font-size="12px" color="#888888" padding-top="20px">
          이 링크는 {{expiresIn}} 후에 만료됩니다.<br/>
          본인이 요청하지 않은 경우 이 이메일을 무시해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#f4f4f4" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#888888">
          © 2025 에뷰리띵. All rights reserved.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  password_reset: {
    subject: '[에뷰리띵] 비밀번호 재설정 안내',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          비밀번호 재설정 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 비밀번호 재설정이 요청되었습니다.<br/>
          아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
        </mj-text>
        <mj-button href="{{resetLink}}" background-color="#FF6B9D" color="#ffffff" font-size="16px" padding="20px 0">
          비밀번호 재설정
        </mj-button>
        <mj-text font-size="12px" color="#888888" padding-top="20px">
          이 링크는 {{expiresIn}} 후에 만료됩니다.<br/>
          본인이 요청하지 않은 경우 이 이메일을 무시해주세요.<br/>
          계정 보안이 우려되시면 고객센터로 연락해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  password_changed: {
    subject: '[에뷰리띵] 비밀번호가 변경되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🔐 비밀번호 변경 완료
        </mj-text>
        <mj-text>
          {{userName}}님의 비밀번호가 성공적으로 변경되었습니다.
        </mj-text>
        <mj-text padding-top="10px">
          <strong>변경 일시:</strong> {{timestamp}}<br/>
          {{#if deviceInfo}}<strong>기기 정보:</strong> {{deviceInfo}}<br/>{{/if}}
          {{#if ipAddress}}<strong>IP 주소:</strong> {{ipAddress}}{{/if}}
        </mj-text>
        <mj-text font-size="12px" color="#FF6B6B" padding-top="20px">
          본인이 변경하지 않았다면 즉시 고객센터(support@e-beautything.com)로 연락해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  new_device_login: {
    subject: '[에뷰리띵] 새로운 기기에서 로그인되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          📱 새로운 기기 로그인 알림
        </mj-text>
        <mj-text>
          {{userName}}님의 계정이 새로운 기기에서 로그인되었습니다.
        </mj-text>
        <mj-text padding-top="10px">
          <strong>로그인 일시:</strong> {{timestamp}}<br/>
          <strong>기기 정보:</strong> {{deviceInfo}}<br/>
          <strong>IP 주소:</strong> {{ipAddress}}
        </mj-text>
        <mj-text font-size="12px" color="#FF6B6B" padding-top="20px">
          본인이 로그인하지 않았다면 즉시 비밀번호를 변경하고 고객센터로 연락해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  // Reservation Templates
  reservation_requested: {
    subject: '[에뷰리띵] 예약 요청이 접수되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          📝 예약 요청 접수
        </mj-text>
        <mj-text>
          {{userName}}님, 예약 요청이 성공적으로 접수되었습니다.<br/>
          매장에서 예약을 확인 후 승인해드립니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>시간:</strong> {{formatTime reservationTime}}<br/>
          <strong>예약번호:</strong> {{reservationId}}
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">결제 정보</mj-text>
        <mj-text>
          <strong>총 금액:</strong> {{formatCurrency totalAmount}}<br/>
          {{#if depositAmount}}<strong>예약금:</strong> {{formatCurrency depositAmount}}{{/if}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_confirmed: {
    subject: '[에뷰리띵] 예약이 확정되었습니다 🎉',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🎉 예약 확정
        </mj-text>
        <mj-text>
          {{userName}}님, 예약이 확정되었습니다!<br/>
          예약 시간에 맞춰 방문해주세요.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>시간:</strong> {{formatTime reservationTime}}<br/>
          <strong>예약번호:</strong> {{reservationId}}<br/>
          {{#if shopAddress}}<strong>주소:</strong> {{shopAddress}}<br/>{{/if}}
          {{#if shopPhone}}<strong>전화:</strong> {{shopPhone}}{{/if}}
        </mj-text>
        <mj-button href="https://app.e-beautything.com/reservations/{{reservationId}}" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          예약 상세 보기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_rejected: {
    subject: '[에뷰리띵] 예약이 거절되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          예약 거절 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 죄송합니다.<br/>
          요청하신 예약이 매장 사정으로 거절되었습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>요청 날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>요청 시간:</strong> {{formatTime reservationTime}}
        </mj-text>
        {{#if cancellationReason}}
        <mj-text padding-top="10px">
          <strong>거절 사유:</strong> {{cancellationReason}}
        </mj-text>
        {{/if}}
        <mj-button href="https://app.e-beautything.com/search" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          다른 시간 예약하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_cancelled_by_user: {
    subject: '[에뷰리띵] 예약이 취소되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          예약 취소 완료
        </mj-text>
        <mj-text>
          {{userName}}님, 예약이 취소되었습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">취소된 예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>예약번호:</strong> {{reservationId}}
        </mj-text>
        {{#if refundAmount}}
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">환불 정보</mj-text>
        <mj-text>
          <strong>환불 금액:</strong> {{formatCurrency refundAmount}}<br/>
          <strong>환불 예정:</strong> 3-5 영업일 이내
        </mj-text>
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_cancelled_by_shop: {
    subject: '[에뷰리띵] 예약이 매장에 의해 취소되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          예약 취소 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 죄송합니다.<br/>
          매장 사정으로 예약이 취소되었습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">취소된 예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>예약번호:</strong> {{reservationId}}
        </mj-text>
        {{#if cancellationReason}}
        <mj-text padding-top="10px">
          <strong>취소 사유:</strong> {{cancellationReason}}
        </mj-text>
        {{/if}}
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text>
          결제하신 금액은 전액 환불됩니다.<br/>
          불편을 드려 죄송합니다.
        </mj-text>
        <mj-button href="https://app.e-beautything.com/search" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          다른 매장 둘러보기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_reminder: {
    subject: '[에뷰리띵] 내일 예약이 있습니다 ⏰',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          ⏰ 예약 리마인더
        </mj-text>
        <mj-text>
          {{userName}}님, 내일 예약이 있습니다!<br/>
          예약 시간을 확인해주세요.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>시간:</strong> {{formatTime reservationTime}}<br/>
          {{#if shopAddress}}<strong>주소:</strong> {{shopAddress}}<br/>{{/if}}
          {{#if shopPhone}}<strong>전화:</strong> {{shopPhone}}{{/if}}
        </mj-text>
        <mj-button href="https://app.e-beautything.com/reservations/{{reservationId}}" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          예약 상세 보기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_completed: {
    subject: '[에뷰리띵] 서비스가 완료되었습니다 ✨',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          ✨ 서비스 완료
        </mj-text>
        <mj-text>
          {{userName}}님, 오늘 서비스는 어떠셨나요?<br/>
          리뷰를 남겨주시면 다른 고객에게 큰 도움이 됩니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">이용 내역</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>결제 금액:</strong> {{formatCurrency totalAmount}}
        </mj-text>
        <mj-button href="https://app.e-beautything.com/reservations/{{reservationId}}/review" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          리뷰 작성하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  reservation_no_show: {
    subject: '[에뷰리띵] 예약 시간에 방문하지 않으셨습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          예약 미방문 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 예약 시간에 방문하지 않으셨습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">예약 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>날짜:</strong> {{formatDate reservationDate}}<br/>
          <strong>시간:</strong> {{formatTime reservationTime}}
        </mj-text>
        <mj-text padding-top="10px" font-size="12px" color="#888888">
          예약 정책에 따라 예약금이 환불되지 않을 수 있습니다.<br/>
          문의사항이 있으시면 고객센터로 연락해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  // Payment Templates
  payment_received: {
    subject: '[에뷰리띵] 결제가 완료되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          💳 결제 완료
        </mj-text>
        <mj-text>
          {{userName}}님, 결제가 정상적으로 완료되었습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">결제 정보</mj-text>
        <mj-text>
          <strong>거래번호:</strong> {{transactionId}}<br/>
          <strong>결제 금액:</strong> {{formatCurrency amount}}<br/>
          <strong>결제 수단:</strong> {{paymentMethod}}
        </mj-text>
        {{#if receiptUrl}}
        <mj-button href="{{receiptUrl}}" background-color="#888888" color="#ffffff" font-size="14px" padding="20px 0">
          영수증 보기
        </mj-button>
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  payment_failed: {
    subject: '[에뷰리띵] 결제에 실패했습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          결제 실패 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 결제가 실패했습니다.<br/>
          다시 시도해주세요.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">결제 정보</mj-text>
        <mj-text>
          <strong>거래번호:</strong> {{transactionId}}<br/>
          <strong>결제 금액:</strong> {{formatCurrency amount}}<br/>
          <strong>결제 수단:</strong> {{paymentMethod}}
        </mj-text>
        <mj-text padding-top="10px" font-size="12px" color="#888888">
          결제 문제가 지속되면 카드사 또는 고객센터로 문의해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  refund_processed: {
    subject: '[에뷰리띵] 환불이 처리되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          환불 처리 완료
        </mj-text>
        <mj-text>
          {{userName}}님, 환불이 처리되었습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">환불 정보</mj-text>
        <mj-text>
          <strong>거래번호:</strong> {{transactionId}}<br/>
          <strong>환불 금액:</strong> {{formatCurrency refundAmount}}<br/>
          {{#if refundReason}}<strong>환불 사유:</strong> {{refundReason}}{{/if}}
        </mj-text>
        <mj-text padding-top="10px" font-size="12px" color="#888888">
          환불 금액은 결제 수단에 따라 3-5 영업일 내에 반영됩니다.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  deposit_reminder: {
    subject: '[에뷰리띵] 잔금 결제 안내',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          잔금 결제 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 예약 잔금 결제 안내드립니다.<br/>
          서비스 당일 잔금을 결제해주세요.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">결제 정보</mj-text>
        <mj-text>
          <strong>매장:</strong> {{shopName}}<br/>
          <strong>서비스:</strong> {{serviceName}}<br/>
          <strong>예약일:</strong> {{formatDate reservationDate}}<br/>
          <strong>잔금:</strong> {{formatCurrency amount}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  // Shop Management Templates
  shop_approved: {
    subject: '[에뷰리띵] 매장 승인이 완료되었습니다 🎉',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🎉 매장 승인 완료
        </mj-text>
        <mj-text>
          {{ownerName}}님, 축하합니다!<br/>
          <strong>{{shopName}}</strong> 매장이 승인되었습니다.
        </mj-text>
        <mj-text padding-top="10px">
          이제 고객 예약을 받을 수 있습니다.<br/>
          매장 관리 페이지에서 서비스와 운영 시간을 설정해주세요.
        </mj-text>
        <mj-button href="https://admin.e-beautything.com/dashboard/my-shop" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          매장 관리 시작하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  shop_rejected: {
    subject: '[에뷰리띵] 매장 등록 심사 결과 안내',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          매장 등록 심사 결과
        </mj-text>
        <mj-text>
          {{ownerName}}님, 안녕하세요.<br/>
          <strong>{{shopName}}</strong> 매장 등록이 승인되지 않았습니다.
        </mj-text>
        {{#if rejectionReason}}
        <mj-text padding-top="10px">
          <strong>거부 사유:</strong><br/>
          {{rejectionReason}}
        </mj-text>
        {{/if}}
        <mj-text padding-top="10px">
          필요한 서류를 보완하여 다시 신청해주세요.
        </mj-text>
        <mj-button href="https://admin.e-beautything.com/shop/registration" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          다시 신청하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  shop_verification_pending: {
    subject: '[에뷰리띵] 매장 등록 신청이 접수되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          매장 등록 신청 접수
        </mj-text>
        <mj-text>
          {{ownerName}}님, 안녕하세요.<br/>
          <strong>{{shopName}}</strong> 매장 등록 신청이 접수되었습니다.
        </mj-text>
        <mj-text padding-top="10px">
          심사 완료까지 1-3 영업일이 소요됩니다.<br/>
          심사 결과는 이메일로 안내드립니다.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  shop_documents_required: {
    subject: '[에뷰리띵] 추가 서류가 필요합니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          추가 서류 요청
        </mj-text>
        <mj-text>
          {{ownerName}}님, 안녕하세요.<br/>
          <strong>{{shopName}}</strong> 매장 심사를 위해 추가 서류가 필요합니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text font-weight="bold">필요 서류</mj-text>
        <mj-text>
          {{#each documentsRequired}}
          • {{this}}<br/>
          {{/each}}
        </mj-text>
        <mj-button href="https://admin.e-beautything.com/shop/registration/documents" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          서류 제출하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  // User Management Templates
  welcome: {
    subject: '[에뷰리띵] 회원가입을 환영합니다! 🎉',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🎉 에뷰리띵에 오신 것을 환영합니다!
        </mj-text>
        <mj-text>
          {{userName}}님, 회원가입이 완료되었습니다.<br/>
          에뷰리띵에서 다양한 뷰티 서비스를 만나보세요.
        </mj-text>
        <mj-text padding-top="20px" font-weight="bold">
          에뷰리띵과 함께하면
        </mj-text>
        <mj-text>
          ✨ 내 주변 최고의 뷰티샵 발견<br/>
          💅 네일, 속눈썹, 왁싱, 헤어 등 다양한 서비스<br/>
          🎁 예약할 때마다 포인트 적립<br/>
          👯 친구 추천하고 보상 받기
        </mj-text>
        <mj-button href="https://app.e-beautything.com/search" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          지금 시작하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  account_suspended: {
    subject: '[에뷰리띵] 계정 이용 제한 안내',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          ⚠️ 계정 이용 제한 안내
        </mj-text>
        <mj-text>
          {{userName}}님, 안녕하세요.<br/>
          서비스 이용 규정 위반으로 계정이 일시 정지되었습니다.
        </mj-text>
        <mj-text padding-top="10px" font-size="12px" color="#888888">
          자세한 내용은 고객센터(support@e-beautything.com)로 문의해주세요.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  account_reactivated: {
    subject: '[에뷰리띵] 계정이 다시 활성화되었습니다',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          ✅ 계정 활성화 완료
        </mj-text>
        <mj-text>
          {{userName}}님, 계정 정지가 해제되어 정상적으로 서비스를 이용하실 수 있습니다.
        </mj-text>
        <mj-button href="https://app.e-beautything.com" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          앱으로 이동
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  role_upgraded: {
    subject: '[에뷰리띵] 권한이 업그레이드되었습니다 🎊',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🎊 권한 업그레이드
        </mj-text>
        <mj-text>
          {{userName}}님, 새로운 권한이 부여되었습니다.<br/>
          추가된 기능을 확인해보세요!
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  data_export_ready: {
    subject: '[에뷰리띵] 개인정보 다운로드 준비 완료',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          📄 개인정보 다운로드 준비 완료
        </mj-text>
        <mj-text>
          {{userName}}님, 요청하신 개인정보 파일이 준비되었습니다.<br/>
          7일 내에 다운로드해주세요.
        </mj-text>
        <mj-button href="https://app.e-beautything.com/account/data-export" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          다운로드하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  account_deletion_scheduled: {
    subject: '[에뷰리띵] 계정 삭제 예정 안내',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          ⚠️ 계정 삭제 예정
        </mj-text>
        <mj-text>
          {{userName}}님, 요청에 따라 7일 후 계정이 영구 삭제됩니다.
        </mj-text>
        <mj-text padding-top="10px">
          계정 삭제를 취소하려면 아래 버튼을 클릭해주세요.
        </mj-text>
        <mj-button href="https://app.e-beautything.com/account/cancel-deletion" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          삭제 취소하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  // Points & Referrals Templates
  points_earned: {
    subject: '[에뷰리띵] 포인트가 적립되었습니다 🎁',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🎁 포인트 적립
        </mj-text>
        <mj-text>
          {{userName}}님, {{formatCurrency pointsAmount}} 포인트가 적립되었습니다!
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text>
          <strong>적립 유형:</strong> {{transactionType}}<br/>
          <strong>적립 포인트:</strong> {{formatCurrency pointsAmount}}P<br/>
          <strong>총 보유 포인트:</strong> {{formatCurrency pointsBalance}}P
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  points_expiring: {
    subject: '[에뷰리띵] 포인트 만료 예정 안내',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          ⏰ 포인트 만료 예정
        </mj-text>
        <mj-text>
          {{userName}}님, {{formatCurrency pointsAmount}}P가 {{expiryDate}}에 만료됩니다.
        </mj-text>
        <mj-text padding-top="10px">
          만료 전에 사용해주세요!
        </mj-text>
        <mj-button href="https://app.e-beautything.com/search" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          예약하고 포인트 사용하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  referral_success: {
    subject: '[에뷰리띵] 친구 추천 보상이 지급되었습니다 🎉',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🎉 추천 보상 지급
        </mj-text>
        <mj-text>
          {{userName}}님이 추천한 친구가 첫 예약을 완료했습니다!<br/>
          {{formatCurrency pointsAmount}}P가 적립되었습니다.
        </mj-text>
        <mj-divider border-color="#eeeeee" padding="20px 0" />
        <mj-text>
          <strong>총 보유 포인트:</strong> {{formatCurrency pointsBalance}}P
        </mj-text>
        <mj-text padding-top="10px" font-size="12px" color="#888888">
          더 많은 친구를 추천하고 포인트를 모아보세요!
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },

  influencer_qualified: {
    subject: '[에뷰리띵] 인플루언서 자격이 부여되었습니다 🌟',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#FF6B9D" padding="20px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
          에뷰리띵
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" padding-bottom="20px">
          🌟 인플루언서 자격 획득
        </mj-text>
        <mj-text>
          {{userName}}님, 축하합니다!<br/>
          인플루언서 자격이 부여되었습니다.
        </mj-text>
        <mj-text padding-top="10px" font-weight="bold">
          인플루언서 특전:
        </mj-text>
        <mj-text>
          ✨ 추천 보상 2배<br/>
          🏷️ 전용 할인 혜택<br/>
          📱 특별 이벤트 초대
        </mj-text>
        <mj-button href="https://app.e-beautything.com/referral" background-color="#FF6B9D" color="#ffffff" font-size="14px" padding="20px 0">
          친구 추천하기
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  },
};

export class EmailTemplateService {
  private compiledTemplates: Map<EmailTemplateId, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.precompileTemplates();
  }

  /**
   * Precompile all email templates for performance
   */
  private precompileTemplates(): void {
    for (const [templateId, template] of Object.entries(EMAIL_TEMPLATES)) {
      try {
        // Convert MJML to HTML
        const { html } = mjml2html(template.mjml, {
          validationLevel: 'soft',
          minify: true,
        });

        // Inline CSS for email client compatibility
        const inlinedHtml = juice(html);

        // Compile Handlebars template
        const compiled = Handlebars.compile(inlinedHtml);
        this.compiledTemplates.set(templateId as EmailTemplateId, compiled);

        logger.debug(`Email template compiled: ${templateId}`);
      } catch (error) {
        logger.error(`Failed to compile email template: ${templateId}`, { error });
      }
    }
  }

  /**
   * Render an email template with data
   */
  renderTemplate(
    templateId: EmailTemplateId,
    data: Record<string, unknown>
  ): { subject: string; html: string; text: string } {
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Email template not found: ${templateId}`);
    }

    const compiledTemplate = this.compiledTemplates.get(templateId);
    if (!compiledTemplate) {
      throw new Error(`Email template not compiled: ${templateId}`);
    }

    // Render subject with Handlebars
    const subjectTemplate = Handlebars.compile(template.subject);
    const subject = subjectTemplate(data);

    // Render HTML body
    const html = compiledTemplate(data);

    // Generate plain text version
    const text = this.htmlToText(html);

    return { subject, html, text };
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get template subject line
   */
  getTemplateSubject(templateId: EmailTemplateId): string {
    const template = EMAIL_TEMPLATES[templateId];
    return template?.subject || '';
  }

  /**
   * Check if template exists
   */
  hasTemplate(templateId: EmailTemplateId): boolean {
    return templateId in EMAIL_TEMPLATES;
  }

  /**
   * Get all available template IDs
   */
  getAvailableTemplates(): EmailTemplateId[] {
    return Object.keys(EMAIL_TEMPLATES) as EmailTemplateId[];
  }
}

export const emailTemplateService = new EmailTemplateService();
export default emailTemplateService;
```

### Step 5: Implement Email Service

**File:** `src/services/email.service.ts`

```typescript
/**
 * Email Service
 * Production-ready email service using AWS SES
 * Supports templated emails, bulk sending, and delivery tracking
 */

import {
  SESClient,
  SendEmailCommand,
  SendBulkTemplatedEmailCommand,
  VerifyEmailIdentityCommand,
  GetSendQuotaCommand,
} from '@aws-sdk/client-ses';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { emailTemplateService } from './email-template.service';
import {
  EmailPayload,
  EmailSendResult,
  EmailLog,
  EmailStatus,
  EmailTemplateId,
  EmailCategory,
  EmailPriority,
  IEmailProvider,
} from '../types/email.types';

export class EmailService implements IEmailProvider {
  private sesClient: SESClient | null = null;
  private supabase = getSupabaseClient();
  private senderEmail: string;
  private senderName: string;
  private replyToEmail: string;
  private isMockMode: boolean;

  constructor() {
    this.isMockMode = config.mockEmail ?? true;
    this.senderEmail = config.aws?.ses?.senderEmail || 'noreply@e-beautything.com';
    this.senderName = config.aws?.ses?.senderName || 'eBeautything';
    this.replyToEmail = config.aws?.ses?.replyToEmail || this.senderEmail;

    if (!this.isMockMode && config.aws?.ses?.accessKeyId && config.aws?.ses?.secretAccessKey) {
      this.sesClient = new SESClient({
        region: config.aws.ses.region || 'ap-northeast-2',
        credentials: {
          accessKeyId: config.aws.ses.accessKeyId,
          secretAccessKey: config.aws.ses.secretAccessKey,
        },
      });
      logger.info('AWS SES client initialized', { region: config.aws.ses.region });
    } else {
      logger.warn('Email service running in mock mode - no emails will be sent');
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();

    try {
      // Validate recipients
      const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
      if (recipients.length === 0) {
        throw new Error('No recipients specified');
      }

      // Build email content
      let subject = payload.subject;
      let htmlContent = payload.htmlContent || '';
      let textContent = payload.textContent || '';

      // If using template, render it
      if (payload.templateId) {
        const rendered = emailTemplateService.renderTemplate(
          payload.templateId,
          payload.templateData || {}
        );
        subject = rendered.subject;
        htmlContent = rendered.html;
        textContent = rendered.text;
      }

      // Mock mode - log and return success
      if (this.isMockMode) {
        logger.info('Mock email sent', {
          to: recipients,
          subject,
          templateId: payload.templateId,
          category: payload.category,
        });

        // Log to database
        await this.logEmail({
          recipientEmail: recipients[0],
          templateId: payload.templateId,
          subject,
          category: payload.category,
          priority: payload.priority,
          status: 'sent',
          messageId: `mock-${Date.now()}`,
          metadata: payload.metadata,
          sentAt: timestamp,
        });

        return {
          success: true,
          messageId: `mock-${Date.now()}`,
          timestamp,
        };
      }

      // Production mode - send via SES
      if (!this.sesClient) {
        throw new Error('SES client not initialized');
      }

      const command = new SendEmailCommand({
        Source: `${this.senderName} <${this.senderEmail}>`,
        Destination: {
          ToAddresses: recipients,
          CcAddresses: payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined,
          BccAddresses: payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined,
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlContent,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textContent,
              Charset: 'UTF-8',
            },
          },
        },
        ReplyToAddresses: [this.replyToEmail],
        ConfigurationSetName: config.aws?.ses?.configurationSet,
      });

      const response = await this.sesClient.send(command);
      const messageId = response.MessageId || '';

      logger.info('Email sent successfully', {
        messageId,
        to: recipients,
        subject,
        templateId: payload.templateId,
      });

      // Log to database
      await this.logEmail({
        recipientEmail: recipients[0],
        templateId: payload.templateId,
        subject,
        category: payload.category,
        priority: payload.priority,
        status: 'sent',
        messageId,
        metadata: payload.metadata,
        sentAt: timestamp,
      });

      return {
        success: true,
        messageId,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to send email', {
        error: errorMessage,
        to: payload.to,
        subject: payload.subject,
        templateId: payload.templateId,
      });

      // Log failed attempt
      await this.logEmail({
        recipientEmail: Array.isArray(payload.to) ? payload.to[0] : payload.to,
        templateId: payload.templateId,
        subject: payload.subject,
        category: payload.category,
        priority: payload.priority,
        status: 'failed',
        errorMessage,
        metadata: payload.metadata,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmail(payloads: EmailPayload[]): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    // Process in batches of 50 (SES limit)
    const batchSize = 50;
    for (let i = 0; i < payloads.length; i += batchSize) {
      const batch = payloads.slice(i, i + batchSize);

      // Send batch in parallel
      const batchResults = await Promise.all(
        batch.map(payload => this.sendEmail(payload))
      );

      results.push(...batchResults);

      // Rate limiting - wait between batches
      if (i + batchSize < payloads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Verify an email address with SES
   */
  async verifyEmail(email: string): Promise<boolean> {
    if (this.isMockMode || !this.sesClient) {
      logger.info('Mock email verification', { email });
      return true;
    }

    try {
      const command = new VerifyEmailIdentityCommand({
        EmailAddress: email,
      });

      await this.sesClient.send(command);
      logger.info('Email verification initiated', { email });
      return true;
    } catch (error) {
      logger.error('Failed to verify email', { email, error });
      return false;
    }
  }

  /**
   * Get SES sending quota
   */
  async getSendingQuota(): Promise<{
    max24HourSend: number;
    maxSendRate: number;
    sentLast24Hours: number;
  } | null> {
    if (this.isMockMode || !this.sesClient) {
      return {
        max24HourSend: 999999,
        maxSendRate: 100,
        sentLast24Hours: 0,
      };
    }

    try {
      const command = new GetSendQuotaCommand({});
      const response = await this.sesClient.send(command);

      return {
        max24HourSend: response.Max24HourSend || 0,
        maxSendRate: response.MaxSendRate || 0,
        sentLast24Hours: response.SentLast24Hours || 0,
      };
    } catch (error) {
      logger.error('Failed to get sending quota', { error });
      return null;
    }
  }

  /**
   * Log email to database
   */
  private async logEmail(data: Partial<EmailLog>): Promise<void> {
    try {
      await this.supabase.from('email_logs').insert({
        recipient_email: data.recipientEmail,
        template_id: data.templateId,
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        status: data.status,
        message_id: data.messageId,
        error_message: data.errorMessage,
        metadata: data.metadata,
        sent_at: data.sentAt,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to log email', { error, data });
    }
  }

  // ========================================
  // Convenience Methods for Common Emails
  // ========================================

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, userName: string): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '', // Will be overridden by template
      templateId: 'welcome',
      templateData: { userName },
      category: 'notification',
      priority: 'medium',
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(
    email: string,
    userName: string,
    verificationLink: string,
    expiresIn: string = '24시간'
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'email_verification',
      templateData: { userName, verificationLink, expiresIn },
      category: 'authentication',
      priority: 'high',
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    userName: string,
    resetLink: string,
    expiresIn: string = '1시간'
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'password_reset',
      templateData: { userName, resetLink, expiresIn },
      category: 'authentication',
      priority: 'high',
    });
  }

  /**
   * Send reservation confirmation email
   */
  async sendReservationConfirmedEmail(
    email: string,
    data: {
      userName: string;
      shopName: string;
      serviceName: string;
      reservationDate: string;
      reservationTime: string;
      totalAmount: number;
      depositAmount?: number;
      reservationId: string;
      shopAddress?: string;
      shopPhone?: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'reservation_confirmed',
      templateData: data,
      category: 'transactional',
      priority: 'high',
      metadata: { reservationId: data.reservationId },
    });
  }

  /**
   * Send reservation cancelled email
   */
  async sendReservationCancelledEmail(
    email: string,
    data: {
      userName: string;
      shopName: string;
      serviceName: string;
      reservationDate: string;
      reservationId: string;
      cancellationReason?: string;
      refundAmount?: number;
    },
    cancelledByShop: boolean = false
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: cancelledByShop ? 'reservation_cancelled_by_shop' : 'reservation_cancelled_by_user',
      templateData: data,
      category: 'transactional',
      priority: 'high',
      metadata: { reservationId: data.reservationId },
    });
  }

  /**
   * Send reservation reminder email
   */
  async sendReservationReminderEmail(
    email: string,
    data: {
      userName: string;
      shopName: string;
      serviceName: string;
      reservationDate: string;
      reservationTime: string;
      reservationId: string;
      shopAddress?: string;
      shopPhone?: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'reservation_reminder',
      templateData: data,
      category: 'notification',
      priority: 'medium',
      metadata: { reservationId: data.reservationId },
    });
  }

  /**
   * Send shop approval email
   */
  async sendShopApprovalEmail(
    email: string,
    ownerName: string,
    shopName: string
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'shop_approved',
      templateData: { ownerName, shopName },
      category: 'notification',
      priority: 'high',
    });
  }

  /**
   * Send shop rejection email
   */
  async sendShopRejectionEmail(
    email: string,
    ownerName: string,
    shopName: string,
    rejectionReason: string
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'shop_rejected',
      templateData: { ownerName, shopName, rejectionReason },
      category: 'notification',
      priority: 'high',
    });
  }

  /**
   * Send points earned email
   */
  async sendPointsEarnedEmail(
    email: string,
    data: {
      userName: string;
      pointsAmount: number;
      pointsBalance: number;
      transactionType: string;
    }
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'points_earned',
      templateData: data,
      category: 'notification',
      priority: 'low',
    });
  }

  /**
   * Send referral success email
   */
  async sendReferralSuccessEmail(
    email: string,
    data: {
      userName: string;
      pointsAmount: number;
      pointsBalance: number;
    }
  ): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: '',
      templateId: 'referral_success',
      templateData: data,
      category: 'notification',
      priority: 'medium',
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
```

### Step 6: Create Database Migration

**File:** `src/migrations/XXX_create_email_logs_table.sql`

```sql
-- Migration: Create email_logs table
-- Purpose: Track all sent emails for audit and debugging

-- Create email status enum
DO $$ BEGIN
  CREATE TYPE email_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'bounced',
    'failed',
    'complained'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create email category enum
DO $$ BEGIN
  CREATE TYPE email_category AS ENUM (
    'transactional',
    'notification',
    'authentication',
    'marketing',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create email priority enum
DO $$ BEGIN
  CREATE TYPE email_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  template_id VARCHAR(100),
  subject VARCHAR(500) NOT NULL,
  category email_category NOT NULL DEFAULT 'notification',
  priority email_priority NOT NULL DEFAULT 'medium',
  status email_status NOT NULL DEFAULT 'pending',
  message_id VARCHAR(255),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_category ON email_logs(category);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id) WHERE message_id IS NOT NULL;

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Admins can see all logs
CREATE POLICY "admin_all_email_logs" ON email_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

-- Users can see their own email logs
CREATE POLICY "users_own_email_logs" ON email_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();

-- Add comment
COMMENT ON TABLE email_logs IS 'Audit log for all sent emails with delivery status tracking';
```

---

## Environment Variables

Add to `.env`:

```bash
# AWS SES Configuration
AWS_SES_REGION=ap-northeast-2
AWS_SES_ACCESS_KEY_ID=your_access_key
AWS_SES_SECRET_ACCESS_KEY=your_secret_key
AWS_SES_SENDER_EMAIL=noreply@e-beautything.com
AWS_SES_SENDER_NAME=eBeautything
AWS_SES_REPLY_TO_EMAIL=support@e-beautything.com
AWS_SES_CONFIGURATION_SET=ebeautything-tracking

# Email mode
MOCK_EMAIL=true  # Set to false in production
EMAIL_DEBUG_MODE=false
```

---

## Testing Plan

### Unit Tests

**File:** `tests/unit/services/email.service.test.ts`

```typescript
import { EmailService } from '../../../src/services/email.service';
import { emailTemplateService } from '../../../src/services/email-template.service';

// Mock AWS SES
jest.mock('@aws-sdk/client-ses');

describe('EmailService', () => {
  let emailService: EmailService;

  beforeAll(() => {
    process.env.MOCK_EMAIL = 'true';
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email successfully in mock mode', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        htmlContent: '<p>Test content</p>',
        textContent: 'Test content',
        category: 'notification',
        priority: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('mock-');
    });

    it('should render template email correctly', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: '',
        templateId: 'welcome',
        templateData: { userName: 'Test User' },
        category: 'notification',
        priority: 'medium',
      });

      expect(result.success).toBe(true);
    });

    it('should fail with invalid template', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: '',
        templateId: 'invalid_template' as any,
        templateData: {},
        category: 'notification',
        priority: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('sendBulkEmail', () => {
    it('should send multiple emails', async () => {
      const payloads = [
        {
          to: 'user1@example.com',
          subject: 'Test 1',
          htmlContent: '<p>Test 1</p>',
          textContent: 'Test 1',
          category: 'notification' as const,
          priority: 'medium' as const,
        },
        {
          to: 'user2@example.com',
          subject: 'Test 2',
          htmlContent: '<p>Test 2</p>',
          textContent: 'Test 2',
          category: 'notification' as const,
          priority: 'medium' as const,
        },
      ];

      const results = await emailService.sendBulkEmail(payloads);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});

describe('EmailTemplateService', () => {
  describe('renderTemplate', () => {
    it('should render welcome template', () => {
      const result = emailTemplateService.renderTemplate('welcome', {
        userName: 'Test User',
      });

      expect(result.subject).toContain('환영');
      expect(result.html).toContain('Test User');
      expect(result.text).toBeTruthy();
    });

    it('should format currency correctly', () => {
      const result = emailTemplateService.renderTemplate('reservation_confirmed', {
        userName: 'Test User',
        shopName: 'Test Shop',
        serviceName: 'Test Service',
        reservationDate: '2025-01-15',
        reservationTime: '14:30',
        totalAmount: 50000,
        reservationId: 'test-123',
      });

      expect(result.html).toContain('₩50,000');
    });

    it('should format date in Korean', () => {
      const result = emailTemplateService.renderTemplate('reservation_confirmed', {
        userName: 'Test User',
        shopName: 'Test Shop',
        serviceName: 'Test Service',
        reservationDate: '2025-01-15',
        reservationTime: '14:30',
        totalAmount: 50000,
        reservationId: 'test-123',
      });

      expect(result.html).toMatch(/2025년.*1월.*15일/);
    });
  });
});
```

---

## Integration with Notification Service

Update `src/services/notification.service.ts` to include email sending:

```typescript
// Add to NotificationService class

import { emailService } from './email.service';

/**
 * Send notification via all enabled channels (push + email + SMS)
 */
async sendMultiChannelNotification(
  userId: string,
  templateId: string,
  data: Record<string, unknown>
): Promise<{ push: boolean; email: boolean; sms: boolean }> {
  const results = { push: false, email: false, sms: false };

  // Get user notification settings
  const settings = await this.getUserNotificationSettings(userId);
  const user = await this.getUserById(userId);

  // Send push notification
  if (settings.pushEnabled) {
    try {
      await this.sendTemplateNotification(userId, templateId, data);
      results.push = true;
    } catch (error) {
      logger.error('Push notification failed', { userId, templateId, error });
    }
  }

  // Send email notification
  if (settings.emailEnabled && user?.email) {
    try {
      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject: '',
        templateId: templateId as EmailTemplateId,
        templateData: {
          userName: user.name || user.nickname || '고객',
          ...data,
        },
        category: 'notification',
        priority: 'medium',
      });
      results.email = emailResult.success;
    } catch (error) {
      logger.error('Email notification failed', { userId, templateId, error });
    }
  }

  // Send SMS notification (if implemented)
  if (settings.smsEnabled && user?.phone_number) {
    // SMS integration here
  }

  return results;
}
```

---

## Deployment Checklist

- [ ] Install npm dependencies
- [ ] Create `src/types/email.types.ts`
- [ ] Create `src/services/email-template.service.ts`
- [ ] Rewrite `src/services/email.service.ts`
- [ ] Update `src/config/environment.ts`
- [ ] Run database migration
- [ ] Configure AWS SES:
  - [ ] Verify sender email address
  - [ ] Request production access (if needed)
  - [ ] Set up bounce/complaint notifications
  - [ ] Create configuration set for tracking
- [ ] Update notification service integration
- [ ] Run unit tests
- [ ] Test in staging with `MOCK_EMAIL=false`
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Email delivery rate | >95% | AWS SES dashboard |
| Bounce rate | <2% | AWS SES metrics |
| Complaint rate | <0.1% | AWS SES metrics |
| Template render time | <100ms | Application logs |
| Email send latency | <2s | Application metrics |

---

## Rollback Plan

1. **Feature flag**: Set `MOCK_EMAIL=true` to disable
2. **Database rollback**: Keep email_logs table but stop writes
3. **Environment revert**: Remove AWS credentials

---

## Security Considerations

1. **PII Protection**: Email addresses are PII - ensure proper encryption at rest
2. **Bounce Handling**: Set up SNS notifications for bounces/complaints
3. **Rate Limiting**: AWS SES has quotas - implement queue if needed
4. **Template Security**: Sanitize all user input in templates
5. **Credential Management**: Use AWS IAM roles or secrets manager
