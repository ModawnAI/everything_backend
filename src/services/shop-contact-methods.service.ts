import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { contactMethodValidationService, ContactMethodType } from './contact-method-validation.service';

export interface ContactMethod {
  method_type: ContactMethodType;
  value: string;
  description?: string;
  is_primary?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface ShopContactMethod {
  id: string;
  shop_id: string;
  method_type: ContactMethodType;
  value: string;
  description?: string;
  is_primary: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ShopContactMethodsService {
  private supabase = getSupabaseClient();

  /**
   * Retrieves all contact methods for a given shop.
   * @param shopId The ID of the shop.
   * @returns An array of contact methods.
   */
  public async getShopContactMethods(shopId: string): Promise<ShopContactMethod[]> {
    const { data, error } = await this.supabase
      .from('shop_contact_methods')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('ShopContactMethodsService.getShopContactMethods: Error fetching contact methods', { shopId, error: error.message });
      throw new Error(`Failed to retrieve shop contact methods: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Updates or creates contact methods for a shop.
   * This method performs a full sync: existing methods not in the input will be deleted,
   * new methods will be created, and existing methods with matching type/value will be updated.
   * @param shopId The ID of the shop.
   * @param contactMethods An array of ContactMethod objects to set for the shop.
   * @returns The updated list of contact methods.
   */
  public async updateShopContactMethods(shopId: string, contactMethods: ContactMethod[]): Promise<ShopContactMethod[]> {
    // 1. Validate input contact methods
    const validationInput = contactMethods.map(cm => ({
      type: cm.method_type,
      value: cm.value
    }));
    contactMethodValidationService.validateMultipleContactMethods(validationInput);

    // Get existing methods
    const { data: existingMethods, error: fetchError } = await this.supabase
      .from('shop_contact_methods')
      .select('id, method_type, value')
      .eq('shop_id', shopId);

    if (fetchError) {
      logger.error('ShopContactMethodsService.updateShopContactMethods: Error fetching existing contact methods', { shopId, error: fetchError.message });
      throw new Error(`Failed to retrieve existing shop contact methods: ${fetchError.message}`);
    }

    const existingMethodsMap = new Map<string, any>();
    existingMethods?.forEach(method => {
      existingMethodsMap.set(`${method.method_type}-${method.value}`, method);
    });

    const methodsToInsert: Omit<ShopContactMethod, 'id' | 'created_at' | 'updated_at'>[] = [];
    const methodsToUpdate: any[] = [];
    const methodsToKeepIds: string[] = [];

    for (const method of contactMethods) {
      const key = `${method.method_type}-${method.value}`;
      const existing = existingMethodsMap.get(key);

      if (existing) {
        // Update existing method
        methodsToUpdate.push({
          ...existing,
          ...method,
          shop_id: shopId,
          updated_at: new Date().toISOString(),
        });
        methodsToKeepIds.push(existing.id);
        existingMethodsMap.delete(key); // Mark as processed
      } else {
        // Insert new method
        methodsToInsert.push({
          shop_id: shopId,
          method_type: method.method_type,
          value: method.value,
          description: method.description,
          is_primary: method.is_primary || false,
          display_order: method.display_order || 0,
          is_active: method.is_active || true,
        });
      }
    }

    // Methods remaining in existingMethodsMap are to be deleted
    const methodsToDeleteIds = Array.from(existingMethodsMap.values()).map(method => method.id);

    try {
      // Delete old methods
      if (methodsToDeleteIds.length > 0) {
        const { error: deleteError } = await this.supabase
          .from('shop_contact_methods')
          .delete()
          .in('id', methodsToDeleteIds);

        if (deleteError) {
          throw new Error(`Failed to delete old contact methods: ${deleteError.message}`);
        }
      }

      // Insert new methods
      if (methodsToInsert.length > 0) {
        const { error: insertError } = await this.supabase
          .from('shop_contact_methods')
          .insert(methodsToInsert);

        if (insertError) {
          throw new Error(`Failed to insert new contact methods: ${insertError.message}`);
        }
      }

      // Update existing methods
      for (const method of methodsToUpdate) {
        const { error: updateError } = await this.supabase
          .from('shop_contact_methods')
          .update(method)
          .eq('id', method.id);

        if (updateError) {
          throw new Error(`Failed to update contact method ${method.id}: ${updateError.message}`);
        }
      }

      // Re-fetch all methods to ensure consistency and return the latest state
      return this.getShopContactMethods(shopId);

    } catch (error: any) {
      logger.error('ShopContactMethodsService.updateShopContactMethods: Transaction failed', { shopId, error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a specific contact method.
   * @param shopId The ID of the shop.
   * @param contactMethodId The ID of the contact method to delete.
   * @returns True if deletion was successful.
   */
  public async deleteShopContactMethod(shopId: string, contactMethodId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('shop_contact_methods')
      .delete()
      .eq('shop_id', shopId)
      .eq('id', contactMethodId);

    if (error) {
      logger.error('ShopContactMethodsService.deleteShopContactMethod: Error deleting contact method', { shopId, contactMethodId, error: error.message });
      throw new Error(`Failed to delete shop contact method: ${error.message}`);
    }

    return true;
  }

  /**
   * Retrieves public contact information for a specific shop.
   * Only returns active contact methods that are marked as public.
   * @param shopId The ID of the shop.
   * @returns An array of public contact methods.
   */
  public async getPublicShopContactInfo(shopId: string): Promise<ShopContactMethod[]> {
    const { data, error } = await this.supabase
      .from('shop_contact_methods')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('ShopContactMethodsService.getPublicShopContactInfo: Error fetching public contact info', { shopId, error: error.message });
      throw new Error(`Failed to retrieve public shop contact information: ${error.message}`);
    }

    return data || [];
  }
}

export const shopContactMethodsService = new ShopContactMethodsService();