/**
 * Phone Verification Types
 * 
 * Types for PASS 인증서 (PASS certification) based phone verification
 * and traditional SMS OTP verification
 */

export type VerificationMethod = 'sms' | 'pass';
export type VerificationStatus = 'pending' | 'completed' | 'failed' | 'expired';

/**
 * PASS verification request interface
 */
export interface PassVerificationRequest {
  phoneNumber: string;
  purpose: string;
  returnUrl: string;
  userId?: string;
}

/**
 * PASS verification result from callback
 */
export interface PassVerificationResult {
  txId: string;
  result: 'success' | 'failure';
  ci?: string; // Connecting Information - encrypted user identifier
  di?: string; // Duplicate Information - for duplicate user detection
  phoneNumber?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Phone verification record in database
 */
export interface PhoneVerificationRecord {
  id: string;
  user_id?: string;
  phone_number: string;
  verification_method: VerificationMethod;
  status: VerificationStatus;
  
  // SMS OTP fields
  otp_code?: string;
  otp_expires_at?: string;
  attempts_count?: number;
  
  // PASS fields
  pass_tx_id?: string;
  pass_ci?: string;
  pass_di?: string;
  pass_redirect_url?: string;
  
  created_at: string;
  updated_at: string;
  verified_at?: string;
  expires_at: string;
}

/**
 * SMS OTP verification request
 */
export interface SmsVerificationRequest {
  phoneNumber: string;
  userId?: string;
}

/**
 * SMS OTP verification data
 */
export interface SmsVerificationData {
  phoneNumber: string;
  otpCode: string;
  expiresAt: Date;
  attemptsCount: number;
}

/**
 * Phone verification initiation response
 */
export interface VerificationInitiationResponse {
  success: boolean;
  data?: {
    method: VerificationMethod;
    txId: string;
    redirectUrl?: string; // For PASS
    expiresAt: string;
    message: string;
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

/**
 * Phone verification confirmation request
 */
export interface VerificationConfirmationRequest {
  txId: string;
  otpCode?: string; // For SMS
  passResult?: PassVerificationResult; // For PASS
}

/**
 * Phone verification confirmation response
 */
export interface VerificationConfirmationResponse {
  success: boolean;
  data?: {
    verified: boolean;
    userId?: string;
    phoneNumber: string;
    method: VerificationMethod;
    message: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

/**
 * PASS service configuration
 */
export interface PassServiceConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  timeoutMs: number;
}

/**
 * SMS service configuration
 */
export interface SmsServiceConfig {
  provider: 'aws-sns' | 'twilio' | 'aligo' | 'coolsms';
  apiKey: string;
  apiSecret: string;
  senderId: string;
  templateId?: string;
}

/**
 * Phone verification service interface
 */
export interface PhoneVerificationService {
  initiateVerification(request: PassVerificationRequest | SmsVerificationRequest, method: VerificationMethod): Promise<string>;
  verifyCode(txId: string, code: string): Promise<boolean>;
  verifyPassResult(txId: string, result: PassVerificationResult): Promise<boolean>;
  getVerificationStatus(txId: string): Promise<PhoneVerificationRecord | null>;
  cleanupExpiredVerifications(): Promise<void>;
}

/**
 * Phone verification errors
 */
export class PhoneVerificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public method?: VerificationMethod
  ) {
    super(message);
    this.name = 'PhoneVerificationError';
  }
}

export class PassVerificationError extends PhoneVerificationError {
  constructor(message: string, details?: string) {
    super(
      `PASS 인증 오류: ${message}${details ? ` (${details})` : ''}`,
      'PASS_VERIFICATION_ERROR',
      400,
      'pass'
    );
    this.name = 'PassVerificationError';
  }
}

export class SmsVerificationError extends PhoneVerificationError {
  constructor(message: string, details?: string) {
    super(
      `SMS 인증 오류: ${message}${details ? ` (${details})` : ''}`,
      'SMS_VERIFICATION_ERROR',
      400,
      'sms'
    );
    this.name = 'SmsVerificationError';
  }
}

export class VerificationExpiredError extends PhoneVerificationError {
  constructor(method: VerificationMethod) {
    super(
      '인증 시간이 만료되었습니다. 다시 시도해주세요.',
      'VERIFICATION_EXPIRED',
      410,
      method
    );
    this.name = 'VerificationExpiredError';
  }
}

export class VerificationLimitExceededError extends PhoneVerificationError {
  constructor(method: VerificationMethod) {
    super(
      '인증 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
      'VERIFICATION_LIMIT_EXCEEDED',
      429,
      method
    );
    this.name = 'VerificationLimitExceededError';
  }
} 