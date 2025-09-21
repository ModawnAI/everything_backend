import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/error-handler';

export interface ModerationRule {
  id: string;
  name: string;
  description: string;
  rule_type: 'content_filter' | 'behavioral_pattern' | 'automated_action' | 'escalation';
  conditions: ModerationRuleCondition[];
  actions: ModerationRuleAction[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModerationRuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than' | 'in_list';
  value: string | number | string[];
  case_sensitive?: boolean;
}

export interface ModerationRuleAction {
  action_type: 'block' | 'flag' | 'warn' | 'notify' | 'escalate' | 'log';
  parameters: Record<string, any>;
  delay_seconds?: number;
}

export interface CreateModerationRuleRequest {
  name: string;
  description: string;
  rule_type: 'content_filter' | 'behavioral_pattern' | 'automated_action' | 'escalation';
  conditions: ModerationRuleCondition[];
  actions: ModerationRuleAction[];
  priority?: number;
  is_active?: boolean;
}

export interface UpdateModerationRuleRequest {
  name?: string;
  description?: string;
  conditions?: ModerationRuleCondition[];
  actions?: ModerationRuleAction[];
  priority?: number;
  is_active?: boolean;
}

class ModerationRulesService {
  /**
   * Get all active moderation rules
   */
  async getActiveRules(): Promise<ModerationRule[]> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('moderation_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch active moderation rules', { error });
        throw new CustomError('Failed to fetch moderation rules', 500);
      }

      return data || [];
    } catch (error) {
      logger.error('Error fetching active moderation rules', { error });
      throw error;
    }
  }

  /**
   * Get all moderation rules (including inactive)
   */
  async getAllRules(limit: number = 50, offset: number = 0): Promise<{
    rules: ModerationRule[];
    total: number;
  }> {
    try {
      const { data: rules, error: rulesError } = await getSupabaseClient()
        .from('moderation_rules')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (rulesError) {
        logger.error('Failed to fetch moderation rules', { error: rulesError });
        throw new CustomError('Failed to fetch moderation rules', 500);
      }

      const { count, error: countError } = await getSupabaseClient()
        .from('moderation_rules')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        logger.error('Failed to fetch moderation rules count', { error: countError });
        throw new CustomError('Failed to fetch moderation rules count', 500);
      }

      return {
        rules: rules || [],
        total: count || 0,
      };
    } catch (error) {
      logger.error('Error fetching moderation rules', { error });
      throw error;
    }
  }

  /**
   * Get a specific moderation rule by ID
   */
  async getRuleById(ruleId: string): Promise<ModerationRule | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('moderation_rules')
        .select('*')
        .eq('id', ruleId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Rule not found
        }
        logger.error('Failed to fetch moderation rule', { error, ruleId });
        throw new CustomError('Failed to fetch moderation rule', 500);
      }

      return data;
    } catch (error) {
      logger.error('Error fetching moderation rule', { error, ruleId });
      throw error;
    }
  }

  /**
   * Create a new moderation rule
   */
  async createRule(ruleData: CreateModerationRuleRequest): Promise<ModerationRule> {
    try {
      // Validate rule data
      this.validateRuleData(ruleData);

      const { data, error } = await getSupabaseClient()
        .from('moderation_rules')
        .insert({
          name: ruleData.name,
          description: ruleData.description,
          rule_type: ruleData.rule_type,
          conditions: ruleData.conditions,
          actions: ruleData.actions,
          priority: ruleData.priority || 0,
          is_active: ruleData.is_active !== false, // Default to true
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create moderation rule', { error, ruleData });
        throw new CustomError('Failed to create moderation rule', 500);
      }

      logger.info('Moderation rule created', {
        ruleId: data.id,
        name: ruleData.name,
        ruleType: ruleData.rule_type
      });

      return data;
    } catch (error) {
      logger.error('Error creating moderation rule', { error, ruleData });
      throw error;
    }
  }

  /**
   * Update a moderation rule
   */
  async updateRule(ruleId: string, updateData: UpdateModerationRuleRequest): Promise<ModerationRule> {
    try {
      // Validate update data if provided
      if (updateData.conditions) {
        updateData.conditions.forEach(condition => this.validateRuleCondition(condition));
      }
      if (updateData.actions) {
        updateData.actions.forEach(action => this.validateRuleAction(action));
      }

      const { data, error } = await getSupabaseClient()
        .from('moderation_rules')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update moderation rule', { error, ruleId, updateData });
        throw new CustomError('Failed to update moderation rule', 500);
      }

      logger.info('Moderation rule updated', { ruleId, updateData });

      return data;
    } catch (error) {
      logger.error('Error updating moderation rule', { error, ruleId, updateData });
      throw error;
    }
  }

  /**
   * Delete a moderation rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('moderation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) {
        logger.error('Failed to delete moderation rule', { error, ruleId });
        throw new CustomError('Failed to delete moderation rule', 500);
      }

      logger.info('Moderation rule deleted', { ruleId });
    } catch (error) {
      logger.error('Error deleting moderation rule', { error, ruleId });
      throw error;
    }
  }

  /**
   * Toggle rule active status
   */
  async toggleRuleStatus(ruleId: string): Promise<ModerationRule> {
    try {
      // Get current rule
      const rule = await this.getRuleById(ruleId);
      if (!rule) {
        throw new CustomError('Moderation rule not found', 404);
      }

      const { data, error } = await getSupabaseClient()
        .from('moderation_rules')
        .update({
          is_active: !rule.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to toggle moderation rule status', { error, ruleId });
        throw new CustomError('Failed to toggle rule status', 500);
      }

      logger.info('Moderation rule status toggled', {
        ruleId,
        newStatus: data.is_active ? 'active' : 'inactive'
      });

      return data;
    } catch (error) {
      logger.error('Error toggling moderation rule status', { error, ruleId });
      throw error;
    }
  }

  /**
   * Evaluate rules against content
   */
  async evaluateRules(content: any): Promise<ModerationRule[]> {
    try {
      const activeRules = await this.getActiveRules();
      const matchingRules: ModerationRule[] = [];

      for (const rule of activeRules) {
        if (this.evaluateRule(rule, content)) {
          matchingRules.push(rule);
        }
      }

      logger.info('Rules evaluated against content', {
        totalRules: activeRules.length,
        matchingRules: matchingRules.length,
        matchingRuleIds: matchingRules.map(r => r.id)
      });

      return matchingRules;
    } catch (error) {
      logger.error('Error evaluating rules against content', { error });
      throw error;
    }
  }

  /**
   * Evaluate a single rule against content
   */
  private evaluateRule(rule: ModerationRule, content: any): boolean {
    try {
      // All conditions must be met for the rule to match
      return rule.conditions.every(condition => this.evaluateCondition(condition, content));
    } catch (error) {
      logger.error('Error evaluating rule', { error, ruleId: rule.id });
      return false;
    }
  }

  /**
   * Evaluate a single condition against content
   */
  private evaluateCondition(condition: ModerationRuleCondition, content: any): boolean {
    try {
      const fieldValue = this.getFieldValue(content, condition.field);
      if (fieldValue === undefined || fieldValue === null) {
        return false;
      }

      switch (condition.operator) {
        case 'equals':
          return this.compareValues(fieldValue, condition.value, condition.case_sensitive);
        case 'contains':
          return this.containsValue(fieldValue, condition.value, condition.case_sensitive);
        case 'matches':
          return this.matchesPattern(fieldValue, String(condition.value));
        case 'greater_than':
          return this.compareNumbers(fieldValue, condition.value, 'gt');
        case 'less_than':
          return this.compareNumbers(fieldValue, condition.value, 'lt');
        case 'in_list':
          return this.isInList(fieldValue, condition.value as string[]);
        default:
          return false;
      }
    } catch (error) {
      logger.error('Error evaluating condition', { error, condition });
      return false;
    }
  }

  /**
   * Get field value from content object
   */
  private getFieldValue(content: any, field: string): any {
    const fields = field.split('.');
    let value = content;
    
    for (const f of fields) {
      if (value && typeof value === 'object' && f in value) {
        value = value[f];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Compare two values for equality
   */
  private compareValues(actual: any, expected: any, caseSensitive: boolean = false): boolean {
    if (!caseSensitive && typeof actual === 'string' && typeof expected === 'string') {
      return actual.toLowerCase() === expected.toLowerCase();
    }
    return actual === expected;
  }

  /**
   * Check if value contains another value
   */
  private containsValue(actual: any, expected: any, caseSensitive: boolean = false): boolean {
    if (typeof actual === 'string' && typeof expected === 'string') {
      if (!caseSensitive) {
        return actual.toLowerCase().includes(expected.toLowerCase());
      }
      return actual.includes(expected);
    }
    return false;
  }

  /**
   * Check if value matches a regex pattern
   */
  private matchesPattern(actual: any, pattern: string): boolean {
    if (typeof actual === 'string') {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(actual);
      } catch (error) {
        logger.error('Invalid regex pattern', { pattern, error });
        return false;
      }
    }
    return false;
  }

  /**
   * Compare numbers
   */
  private compareNumbers(actual: any, expected: any, operator: 'gt' | 'lt'): boolean {
    const numActual = Number(actual);
    const numExpected = Number(expected);
    
    if (isNaN(numActual) || isNaN(numExpected)) {
      return false;
    }
    
    return operator === 'gt' ? numActual > numExpected : numActual < numExpected;
  }

  /**
   * Check if value is in a list
   */
  private isInList(actual: any, list: string[]): boolean {
    return list.includes(String(actual));
  }

  /**
   * Validate rule data
   */
  private validateRuleData(ruleData: CreateModerationRuleRequest): void {
    if (!ruleData.name || ruleData.name.trim().length === 0) {
      throw new CustomError('Rule name is required', 400);
    }

    if (!ruleData.description || ruleData.description.trim().length === 0) {
      throw new CustomError('Rule description is required', 400);
    }

    if (!ruleData.rule_type) {
      throw new CustomError('Rule type is required', 400);
    }

    if (!ruleData.conditions || ruleData.conditions.length === 0) {
      throw new CustomError('At least one condition is required', 400);
    }

    if (!ruleData.actions || ruleData.actions.length === 0) {
      throw new CustomError('At least one action is required', 400);
    }

    ruleData.conditions.forEach(condition => this.validateRuleCondition(condition));
    ruleData.actions.forEach(action => this.validateRuleAction(action));
  }

  /**
   * Validate rule condition
   */
  private validateRuleCondition(condition: ModerationRuleCondition): void {
    if (!condition.field || condition.field.trim().length === 0) {
      throw new CustomError('Condition field is required', 400);
    }

    if (!condition.operator) {
      throw new CustomError('Condition operator is required', 400);
    }

    if (condition.value === undefined || condition.value === null) {
      throw new CustomError('Condition value is required', 400);
    }
  }

  /**
   * Validate rule action
   */
  private validateRuleAction(action: ModerationRuleAction): void {
    if (!action.action_type) {
      throw new CustomError('Action type is required', 400);
    }

    if (!action.parameters || typeof action.parameters !== 'object') {
      throw new CustomError('Action parameters are required', 400);
    }
  }

  /**
   * Create default moderation rules
   */
  async createDefaultRules(): Promise<void> {
    try {
      const defaultRules: CreateModerationRuleRequest[] = [
        {
          name: 'Profanity Detection',
          description: 'Automatically flag content containing profanity',
          rule_type: 'content_filter',
          conditions: [
            {
              field: 'description',
              operator: 'matches',
              value: '\\b(fuck|shit|damn|bitch|asshole)\\b',
              case_sensitive: false
            }
          ],
          actions: [
            {
              action_type: 'flag',
              parameters: { reason: 'Profanity detected' }
            }
          ],
          priority: 100,
          is_active: true
        },
        {
          name: 'Spam Content Detection',
          description: 'Detect and flag spam content',
          rule_type: 'content_filter',
          conditions: [
            {
              field: 'description',
              operator: 'matches',
              value: '\\b(buy now|click here|limited time|act now)\\b',
              case_sensitive: false
            }
          ],
          actions: [
            {
              action_type: 'flag',
              parameters: { reason: 'Spam content detected' }
            }
          ],
          priority: 90,
          is_active: true
        },
        {
          name: 'Multiple Reports Escalation',
          description: 'Escalate shops with multiple reports',
          rule_type: 'escalation',
          conditions: [
            {
              field: 'report_count',
              operator: 'greater_than',
              value: 3
            }
          ],
          actions: [
            {
              action_type: 'escalate',
              parameters: { reason: 'Multiple reports received' }
            }
          ],
          priority: 80,
          is_active: true
        }
      ];

      for (const ruleData of defaultRules) {
        try {
          await this.createRule(ruleData);
        } catch (error) {
          logger.warn('Failed to create default rule', { ruleData, error });
        }
      }

      logger.info('Default moderation rules creation completed');
    } catch (error) {
      logger.error('Error creating default moderation rules', { error });
      throw error;
    }
  }
}

export const moderationRulesService = new ModerationRulesService();
