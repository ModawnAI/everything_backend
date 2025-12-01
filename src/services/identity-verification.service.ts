/**
 * PortOne Identity Verification Service
 *
 * Service for handling Danal identity verification using PortOne V2 API
 * Supports both SDK and API-based verification flows
 */

import { PortOneClient } from '@portone/server-sdk';
import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface IdentityVerificationRequest {
  userId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  minAge?: number;
  customData?: Record<string, any>;
}

export interface DanalBypassParams {
  IsCarrier?: string; // SKT, KTF, LGT, MVNO or combination with ;
  AGELIMIT?: number;
  CPTITLE?: string;
}

export interface IdentityVerificationInitResponse {
  verificationId: string;
  storeId: string;
  channelKey: string;
}

export interface VerifiedCustomer {
  id?: string;
  name: string;
  phoneNumber: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE';
  isForeigner: boolean;
  ci: string; // Connecting Information
  di?: string; // Duplication Information
  operator?: string; // Mobile carrier
}

export interface IdentityVerificationResult {
  verificationId: string;
  status: 'READY' | 'VERIFIED' | 'FAILED';
  verifiedCustomer?: VerifiedCustomer;
  requestedAt: string;
  verifiedAt?: string;
  statusChangedAt: string;
  pgTxId?: string;
  pgRawResponse?: any;
}

export class IdentityVerificationService {
  private supabase = getSupabaseClient();
  private client: ReturnType<typeof PortOneClient>;
  private readonly storeId: string;
  private readonly channelKey: string;

  constructor() {
    // Use PortOne V2 configuration
    this.storeId = config.payments.portone.v2.storeId || '';
    this.channelKey = config.payments.portone.v2.identityVerificationChannelKey || '';

    // Initialize PortOne SDK client
    if (config.payments.portone.v2.apiSecret) {
      this.client = PortOneClient({
        secret: config.payments.portone.v2.apiSecret
      });
    } else {
      logger.warn('PortOne V2 API secret not configured. Identity verification will fail.');
      this.client = null as any;
    }

    if (!this.storeId || !this.channelKey) {
      logger.warn('PortOne V2 identity verification configuration is incomplete. Verification may fail.');
    }
  }

  /**
   * Initialize identity verification
   * Creates a verification record and returns configuration for frontend SDK
   */
  async initializeVerification(request: IdentityVerificationRequest): Promise<IdentityVerificationInitResponse> {
    try {
      logger.info('Initializing identity verification', {
        userId: request.userId,
        customerId: request.customerId
      });

      // Generate unique verification ID
      const verificationId = this.generateVerificationId();

      // Create verification record in database
      const { error } = await this.supabase
        .from('identity_verifications')
        .insert({
          verification_id: verificationId,
          store_id: this.storeId,
          channel_key: this.channelKey,
          user_id: request.userId || null,
          customer_id: request.customerId || null,
          status: 'READY',
          custom_data: request.customData || {},
          requested_at: new Date().toISOString(),
          metadata: {
            customerName: request.customerName,
            customerPhone: request.customerPhone,
            minAge: request.minAge,
            initiatedAt: new Date().toISOString()
          }
        });

      if (error) {
        logger.error('Failed to create verification record', { error: error.message });
        throw new Error(`Failed to create verification record: ${error.message}`);
      }

      logger.info('Identity verification initialized', { verificationId });

      return {
        verificationId,
        storeId: this.storeId,
        channelKey: this.channelKey
      };

    } catch (error) {
      logger.error('Failed to initialize identity verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Get verification result from PortOne API
   */
  async getVerificationResult(verificationId: string): Promise<IdentityVerificationResult> {
    try {
      logger.info('Fetching verification result', { verificationId });

      // Call PortOne API to get verification details
      const verification = await this.client.identityVerification.getIdentityVerification({
        identityVerificationId: verificationId
      });

      logger.info('Verification result fetched', {
        verificationId,
        status: verification.status
      });

      // Map PortOne response to our format
      // Use type assertion to access common properties across different verification states
      const verificationData = verification as any;
      const result: IdentityVerificationResult = {
        verificationId: verificationData.id || verificationId,
        status: verification.status as 'READY' | 'VERIFIED' | 'FAILED',
        requestedAt: verificationData.requestedAt,
        verifiedAt: verificationData.verifiedAt,
        statusChangedAt: verificationData.statusChangedAt,
        pgTxId: verificationData.pgTxId,
        pgRawResponse: verificationData.pgRawResponse
      };

      // Add verified customer info if verification was successful
      if (verification.status === 'VERIFIED' && verification.verifiedCustomer) {
        result.verifiedCustomer = {
          id: verification.verifiedCustomer.id,
          name: verification.verifiedCustomer.name,
          phoneNumber: verification.verifiedCustomer.phoneNumber,
          birthDate: verification.verifiedCustomer.birthDate,
          gender: verification.verifiedCustomer.gender as 'MALE' | 'FEMALE',
          isForeigner: verification.verifiedCustomer.isForeigner || false,
          ci: verification.verifiedCustomer.ci,
          di: verification.verifiedCustomer.di,
          operator: verification.verifiedCustomer.operator
        };
      }

      return result;

    } catch (error) {
      logger.error('Failed to fetch verification result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId
      });
      throw error;
    }
  }

  /**
   * Process verification completion and update database
   */
  async processVerificationResult(verificationId: string, userId?: string): Promise<IdentityVerificationResult> {
    try {
      logger.info('Processing verification result', { verificationId, userId });

      // Get verification result from PortOne
      const result = await this.getVerificationResult(verificationId);

      // Update database record
      const updates: any = {
        status: result.status,
        status_changed_at: result.statusChangedAt,
        pg_tx_id: result.pgTxId,
        pg_raw_response: result.pgRawResponse,
        updated_at: new Date().toISOString()
      };

      // Add user_id if provided and not already set
      if (userId) {
        updates.user_id = userId;
      }

      // Add verified customer data if verification succeeded
      if (result.status === 'VERIFIED' && result.verifiedCustomer) {
        updates.verified_customer = result.verifiedCustomer;
        updates.verified_at = result.verifiedAt;
      }

      const { error } = await this.supabase
        .from('identity_verifications')
        .update(updates)
        .eq('verification_id', verificationId);

      if (error) {
        logger.error('Failed to update verification record', {
          error: error.message,
          verificationId
        });
        throw new Error(`Failed to update verification record: ${error.message}`);
      }

      logger.info('Verification result processed successfully', {
        verificationId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('Failed to process verification result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId
      });
      throw error;
    }
  }

  /**
   * Check for duplicate user by CI (Connecting Information)
   * Returns existing user if found
   */
  async checkDuplicateByCi(ci: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('identity_verifications')
        .select('user_id, verified_customer, created_at')
        .eq('status', 'VERIFIED')
        .contains('verified_customer', { ci })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        logger.error('Error checking duplicate by CI', { error: error.message });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to check duplicate by CI', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Check for duplicate user by DI (Duplication Information)
   * Returns existing user if found
   */
  async checkDuplicateByDi(di: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('identity_verifications')
        .select('user_id, verified_customer, created_at')
        .eq('status', 'VERIFIED')
        .contains('verified_customer', { di })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error checking duplicate by DI', { error: error.message });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to check duplicate by DI', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Validate age restriction
   * Returns true if user meets age requirement, false otherwise
   */
  validateAgeRestriction(birthDate: string, minAge: number): boolean {
    try {
      const birthDateTime = new Date(birthDate);
      const today = new Date();

      let age = today.getFullYear() - birthDateTime.getFullYear();
      const monthDiff = today.getMonth() - birthDateTime.getMonth();

      // Adjust age if birthday hasn't occurred this year
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateTime.getDate())) {
        age--;
      }

      return age >= minAge;
    } catch (error) {
      logger.error('Failed to validate age restriction', {
        error: error instanceof Error ? error.message : 'Unknown error',
        birthDate,
        minAge
      });
      return false;
    }
  }

  /**
   * Get user's verification history
   */
  async getUserVerifications(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('identity_verifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user verifications', {
          error: error.message,
          userId
        });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to fetch user verifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return [];
    }
  }

  /**
   * Get verification by ID
   */
  async getVerificationById(verificationId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('identity_verifications')
        .select('*')
        .eq('verification_id', verificationId)
        .single();

      if (error) {
        logger.error('Error fetching verification', {
          error: error.message,
          verificationId
        });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to fetch verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId
      });
      return null;
    }
  }

  /**
   * Generate unique verification ID
   */
  private generateVerificationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `identity-verification-${timestamp}-${random}`;
  }

  /**
   * Build bypass parameters for Danal
   */
  buildDanalBypass(params: DanalBypassParams): any {
    const bypass: any = {};

    if (params.IsCarrier || params.AGELIMIT || params.CPTITLE) {
      bypass.danal = {};

      if (params.IsCarrier) {
        bypass.danal.IsCarrier = params.IsCarrier;
      }

      if (params.AGELIMIT) {
        bypass.danal.AGELIMIT = params.AGELIMIT;
      }

      if (params.CPTITLE) {
        bypass.danal.CPTITLE = params.CPTITLE;
      } else {
        // Default CPTITLE to avoid PortOne default
        bypass.danal.CPTITLE = '에뷰리띵';
      }
    }

    return bypass;
  }
}

// Export singleton instance
export const identityVerificationService = new IdentityVerificationService();
