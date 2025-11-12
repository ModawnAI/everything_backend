/**
 * User Payment Methods Service
 *
 * Manages user payment methods (billing keys) for quick checkout:
 * - Register new payment methods via PortOne billing keys
 * - List, update, and delete saved payment methods
 * - Verify billing keys with PortOne API
 * - Handle payment method metadata
 */

import { getSupabaseClient } from '../config/database';
import { PortOneClient } from '@portone/server-sdk';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface RegisterPaymentMethodParams {
  userId: string;
  billingKey: string;
  nickname?: string;
  setAsDefault?: boolean;
}

export interface PaymentMethodInfo {
  id: string;
  userId: string;
  billingKey: string;
  paymentMethodType: string;
  cardCompany?: string;
  cardType?: string;
  cardNumberMasked?: string;
  cardNumberLast4?: string;
  cardBrand?: string;
  nickname?: string;
  isDefault: boolean;
  isActive: boolean;
  issuedAt?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export class UserPaymentMethodsService {
  private supabase = getSupabaseClient();
  private portoneClient: ReturnType<typeof PortOneClient> | null = null;
  private readonly hasApiKey: boolean;

  constructor() {
    const apiSecret = config.payments?.portone?.v2?.apiSecret;
    this.hasApiKey = !!apiSecret;

    if (apiSecret) {
      this.portoneClient = PortOneClient({ secret: apiSecret });
      logger.info('UserPaymentMethodsService initialized with PortOne API credentials');
    } else {
      logger.warn('UserPaymentMethodsService initialized WITHOUT PortOne API credentials - billing key verification will be skipped');
    }
  }

  /**
   * Register new payment method by verifying and saving billing key
   * Gracefully handles missing API keys for development
   */
  async registerPaymentMethod(params: RegisterPaymentMethodParams): Promise<PaymentMethodInfo> {
    try {
      logger.info('Registering payment method', {
        userId: params.userId,
        hasApiKey: this.hasApiKey,
        billingKeyPrefix: params.billingKey.substring(0, 20),
      });

      let billingKeyInfo: any = null;
      let cardInfo: any = null;

      // Verify billing key with PortOne API (if API key available)
      if (this.hasApiKey && this.portoneClient) {
        try {
          billingKeyInfo = await this.portoneClient.billingKey.getBillingKeyInfo({
            billingKey: params.billingKey,
          });

          if (!billingKeyInfo || billingKeyInfo.status === 'DELETED') {
            throw new Error('Invalid or deleted billing key');
          }

          // Extract card info from billing key
          cardInfo = billingKeyInfo.methods?.[0];

          logger.info('Billing key verified with PortOne API', {
            billingKey: params.billingKey,
            status: billingKeyInfo.status,
            methodType: cardInfo?.type,
          });
        } catch (apiError) {
          logger.error('PortOne API verification failed', {
            error: apiError instanceof Error ? apiError.message : 'Unknown error',
            billingKey: params.billingKey,
          });
          throw new Error('PortOne 빌링키 검증에 실패했습니다.');
        }
      } else {
        logger.warn('Skipping PortOne API verification (no API key) - saving billing key without verification');
        // In development without API key, we still save the billing key
        // but mark it clearly in metadata
        cardInfo = {
          type: 'CARD',
          card: {
            publisher: { name: 'Unknown (개발 모드)' },
            type: 'CREDIT',
            number: '****-****-****-0000',
          },
        };
      }

      // Check if user already has this billing key
      const { data: existing } = await this.supabase
        .from('user_payment_methods')
        .select('id')
        .eq('user_id', params.userId)
        .eq('billing_key', params.billingKey)
        .eq('is_active', true)
        .single();

      if (existing) {
        throw new Error('이미 등록된 결제 수단입니다.');
      }

      // If setting as default, unset other defaults first
      if (params.setAsDefault) {
        await this.supabase
          .from('user_payment_methods')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('user_id', params.userId)
          .eq('is_default', true);
      }

      // Generate nickname if not provided
      const generatedNickname = params.nickname || this.generateNickname(cardInfo);

      // Save to database
      const { data: paymentMethod, error } = await this.supabase
        .from('user_payment_methods')
        .insert({
          user_id: params.userId,
          billing_key: params.billingKey,
          portone_customer_id: billingKeyInfo?.customer?.id || null,
          issue_id: billingKeyInfo?.issueId || null,
          issue_name: billingKeyInfo?.issueName || null,
          payment_method_type: cardInfo?.type || 'CARD',
          card_company: cardInfo?.card?.publisher?.name || null,
          card_type: cardInfo?.card?.type || null,
          card_number_masked: this.maskCardNumber(cardInfo?.card?.number),
          card_number_last4: cardInfo?.card?.number?.slice(-4) || null,
          card_brand: cardInfo?.card?.brand || null,
          nickname: generatedNickname,
          is_default: params.setAsDefault || false,
          is_active: true,
          issued_at: billingKeyInfo?.issuedAt || new Date().toISOString(),
          expires_at: this.calculateCardExpiry(cardInfo),
          portone_metadata: this.hasApiKey ? billingKeyInfo : { dev_mode: true, verified: false },
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to save payment method', {
          error: error.message,
          userId: params.userId,
        });
        throw new Error('결제 수단 저장에 실패했습니다.');
      }

      logger.info('Payment method registered successfully', {
        userId: params.userId,
        paymentMethodId: paymentMethod.id,
        cardLast4: paymentMethod.card_number_last4,
        verified: this.hasApiKey,
      });

      return this.mapToPaymentMethodInfo(paymentMethod);

    } catch (error) {
      logger.error('Error in registerPaymentMethod', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: params.userId,
      });
      throw error;
    }
  }

  /**
   * Get all active payment methods for a user
   */
  async getUserPaymentMethods(userId: string): Promise<PaymentMethodInfo[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        // Handle table not found gracefully (migration not run yet)
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          logger.warn('user_payment_methods table does not exist - migration not run yet', { userId });
          return []; // Return empty array instead of crashing
        }

        logger.error('Failed to fetch payment methods', {
          error: error.message,
          userId,
        });
        throw error;
      }

      return (data || []).map(pm => this.mapToPaymentMethodInfo(pm));

    } catch (error) {
      // Gracefully handle table not found
      if (error instanceof Error && error.message?.includes('does not exist')) {
        logger.warn('Gracefully handling missing user_payment_methods table', { userId });
        return [];
      }

      logger.error('Error in getUserPaymentMethods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * Get a specific payment method (with ownership verification)
   */
  async getPaymentMethod(paymentMethodId: string, userId: string): Promise<PaymentMethodInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToPaymentMethodInfo(data);

    } catch (error) {
      logger.error('Error in getPaymentMethod', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
        userId,
      });
      return null;
    }
  }

  /**
   * Get user's default payment method
   */
  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethodInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToPaymentMethodInfo(data);

    } catch (error) {
      logger.error('Error in getDefaultPaymentMethod', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return null;
    }
  }

  /**
   * Set a payment method as default
   */
  async setDefaultPaymentMethod(paymentMethodId: string, userId: string): Promise<PaymentMethodInfo> {
    try {
      // First, verify the payment method belongs to the user
      const paymentMethod = await this.getPaymentMethod(paymentMethodId, userId);
      if (!paymentMethod) {
        throw new Error('결제 수단을 찾을 수 없습니다.');
      }

      // Unset all other defaults for this user
      await this.supabase
        .from('user_payment_methods')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_default', true);

      // Set this one as default
      const { data, error } = await this.supabase
        .from('user_payment_methods')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to set default payment method', {
          error: error.message,
          paymentMethodId,
          userId,
        });
        throw error;
      }

      logger.info('Default payment method updated', {
        userId,
        paymentMethodId,
      });

      return this.mapToPaymentMethodInfo(data);

    } catch (error) {
      logger.error('Error in setDefaultPaymentMethod', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete payment method (soft delete)
   * Optionally delete from PortOne as well
   */
  async deletePaymentMethod(paymentMethodId: string, userId: string, deleteFromPortOne = true): Promise<void> {
    try {
      // Get payment method
      const paymentMethod = await this.getPaymentMethod(paymentMethodId, userId);
      if (!paymentMethod) {
        throw new Error('결제 수단을 찾을 수 없습니다.');
      }

      // Delete from PortOne if API key available and requested
      if (deleteFromPortOne && this.hasApiKey && this.portoneClient) {
        try {
          await this.portoneClient.billingKey.deleteBillingKey({
            billingKey: paymentMethod.billingKey,
          });

          logger.info('Billing key deleted from PortOne', {
            billingKey: paymentMethod.billingKey,
          });
        } catch (apiError) {
          logger.warn('Failed to delete billing key from PortOne (continuing with local delete)', {
            error: apiError instanceof Error ? apiError.message : 'Unknown error',
            billingKey: paymentMethod.billingKey,
          });
          // Continue with local delete even if PortOne delete fails
        }
      }

      // Soft delete in database
      const { error } = await this.supabase
        .from('user_payment_methods')
        .update({
          is_active: false,
          is_default: false,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentMethodId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to delete payment method', {
          error: error.message,
          paymentMethodId,
          userId,
        });
        throw error;
      }

      logger.info('Payment method deleted successfully', {
        userId,
        paymentMethodId,
        deletedFromPortOne: deleteFromPortOne && this.hasApiKey,
      });

    } catch (error) {
      logger.error('Error in deletePaymentMethod', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update payment method nickname
   */
  async updatePaymentMethodNickname(paymentMethodId: string, userId: string, nickname: string): Promise<PaymentMethodInfo> {
    try {
      const { data, error } = await this.supabase
        .from('user_payment_methods')
        .update({ nickname, updated_at: new Date().toISOString() })
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Payment method nickname updated', {
        userId,
        paymentMethodId,
        nickname,
      });

      return this.mapToPaymentMethodInfo(data);

    } catch (error) {
      logger.error('Error updating payment method nickname', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Record payment method usage
   */
  async recordPaymentMethodUsage(paymentMethodId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_payment_method_usage', {
        payment_method_id: paymentMethodId,
      });

      logger.info('Payment method usage recorded', { paymentMethodId });

    } catch (error) {
      // Non-critical error, just log
      logger.warn('Failed to record payment method usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethodId,
      });
    }
  }

  /**
   * Helper: Mask card number for display
   * @example "1234567812345678" → "1234-****-****-5678"
   */
  private maskCardNumber(cardNumber?: string): string {
    if (!cardNumber || cardNumber.length < 8) {
      return '****-****-****-****';
    }

    const first4 = cardNumber.slice(0, 4);
    const last4 = cardNumber.slice(-4);
    return `${first4}-****-****-${last4}`;
  }

  /**
   * Helper: Generate user-friendly nickname
   */
  private generateNickname(cardInfo: any): string {
    if (!cardInfo?.card) {
      return '내 카드';
    }

    const company = cardInfo.card.publisher?.name || '카드';
    const last4 = cardInfo.card.number?.slice(-4) || '****';
    const type = cardInfo.card.type === 'CREDIT' ? '신용' : '체크';

    return `${company} ${type}카드 (${last4})`;
  }

  /**
   * Helper: Calculate card expiry date from card info
   */
  private calculateCardExpiry(cardInfo: any): string | null {
    if (!cardInfo?.card?.expiryYear || !cardInfo?.card?.expiryMonth) {
      return null;
    }

    const year = cardInfo.card.expiryYear;
    const month = cardInfo.card.expiryMonth.toString().padStart(2, '0');

    // Create date for last day of expiry month
    return new Date(`20${year}-${month}-28T23:59:59Z`).toISOString();
  }

  /**
   * Helper: Map database record to PaymentMethodInfo
   */
  private mapToPaymentMethodInfo(data: any): PaymentMethodInfo {
    return {
      id: data.id,
      userId: data.user_id,
      billingKey: data.billing_key,
      paymentMethodType: data.payment_method_type,
      cardCompany: data.card_company,
      cardType: data.card_type,
      cardNumberMasked: data.card_number_masked,
      cardNumberLast4: data.card_number_last4,
      cardBrand: data.card_brand,
      nickname: data.nickname,
      isDefault: data.is_default,
      isActive: data.is_active,
      issuedAt: data.issued_at,
      expiresAt: data.expires_at,
      lastUsedAt: data.last_used_at,
      usageCount: data.usage_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Export singleton instance
export const userPaymentMethodsService = new UserPaymentMethodsService();
