/**
 * Automated Payment Blocking Service
 * 
 * Automated payment blocking and whitelist/blacklist management system:
 * - Real-time payment blocking based on fraud detection results
 * - Dynamic whitelist and blacklist management
 * - Risk-based blocking policies and rules
 * - Automated blocking decision engine
 * - Blocking override and manual review workflows
 * - Blocking analytics and reporting
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface BlockingRule {
  id: string;
  name: string;
  description: string;
  type: 'automatic' | 'manual' | 'scheduled';
  conditions: BlockingCondition[];
  actions: BlockingAction[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata: Record<string, any>;
}

export interface BlockingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'regex';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface BlockingAction {
  type: 'block_payment' | 'require_verification' | 'flag_for_review' | 'send_alert' | 'add_to_blacklist' | 'add_to_whitelist';
  parameters: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
}

export interface BlockingDecision {
  shouldBlock: boolean;
  blockingReason: string;
  blockingRule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  actions: BlockingAction[];
  overrideRequired: boolean;
  reviewRequired: boolean;
  metadata: Record<string, any>;
}

export interface WhitelistEntry {
  id: string;
  type: 'user' | 'ip_address' | 'email' | 'phone' | 'card_number' | 'device_fingerprint';
  value: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface BlacklistEntry {
  id: string;
  type: 'user' | 'ip_address' | 'email' | 'phone' | 'card_number' | 'device_fingerprint' | 'country' | 'isp';
  value: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

export interface BlockingEvent {
  id: string;
  userId: string;
  paymentId: string;
  blockingRule: string;
  blockingReason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: BlockingAction[];
  isOverridden: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
  overrideReason?: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BlockingOverride {
  id: string;
  blockingEventId: string;
  overriddenBy: string;
  overrideReason: string;
  newAction: 'allow' | 'block' | 'review';
  overrideType: 'admin' | 'system' | 'user';
  isPermanent: boolean;
  expiresAt?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface BlockingAnalytics {
  totalBlocks: number;
  blocksBySeverity: Record<string, number>;
  blocksByRule: Record<string, number>;
  blocksByTimeframe: Array<{
    timeframe: string;
    count: number;
    percentage: number;
  }>;
  overrideRate: number;
  falsePositiveRate: number;
  averageResolutionTime: number; // in minutes
  topBlockingReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  whitelistSize: number;
  blacklistSize: number;
  activeRules: number;
}

export class AutomatedPaymentBlockingService {
  private supabase = getSupabaseClient();
  private blockingRules: Map<string, BlockingRule> = new Map();
  private whitelist: Map<string, WhitelistEntry> = new Map();
  private blacklist: Map<string, BlacklistEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Make a blocking decision for a payment request
   */
  async makeBlockingDecision(request: {
    userId: string;
    paymentId: string;
    amount: number;
    paymentMethod: string;
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
    email?: string;
    phone?: string;
    cardNumber?: string;
    country?: string;
    isp?: string;
    fraudScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    detectedRules: Array<{
      ruleId: string;
      ruleName: string;
      riskLevel: string;
      action: string;
    }>;
    metadata: Record<string, any>;
  }): Promise<BlockingDecision> {
    try {
      logger.info('Making blocking decision', {
        userId: request.userId,
        paymentId: request.paymentId,
        fraudScore: request.fraudScore,
        riskLevel: request.riskLevel
      });

      // Refresh cache if needed
      await this.refreshCacheIfNeeded();

      // Check whitelist first
      const whitelistCheck = await this.checkWhitelist(request);
      if (whitelistCheck.isWhitelisted) {
        return {
          shouldBlock: false,
          blockingReason: 'Whitelisted',
          blockingRule: 'whitelist_check',
          severity: 'low',
          confidence: 100,
          actions: [],
          overrideRequired: false,
          reviewRequired: false,
          metadata: {
            whitelistEntry: whitelistCheck.entry,
            bypassReason: 'User/entity is whitelisted'
          }
        };
      }

      // Check blacklist
      const blacklistCheck = await this.checkBlacklist(request);
      if (blacklistCheck.isBlacklisted) {
        return {
          shouldBlock: true,
          blockingReason: `Blacklisted: ${blacklistCheck.entry.reason}`,
          blockingRule: 'blacklist_check',
          severity: blacklistCheck.entry.severity,
          confidence: 100,
          actions: [{
            type: 'block_payment',
            parameters: { reason: blacklistCheck.entry.reason },
            severity: blacklistCheck.entry.severity,
            message: `Payment blocked due to blacklist: ${blacklistCheck.entry.reason}`
          }],
          overrideRequired: true,
          reviewRequired: true,
          metadata: {
            blacklistEntry: blacklistCheck.entry,
            blockingReason: 'Entity is blacklisted'
          }
        };
      }

      // Evaluate blocking rules
      const ruleResults = await this.evaluateBlockingRules(request);
      
      if (ruleResults.length === 0) {
        return {
          shouldBlock: false,
          blockingReason: 'No blocking rules triggered',
          blockingRule: 'no_rules',
          severity: 'low',
          confidence: 100,
          actions: [],
          overrideRequired: false,
          reviewRequired: false,
          metadata: {
            evaluatedRules: this.blockingRules.size,
            triggeredRules: 0
          }
        };
      }

      // Find the highest priority rule that should block
      const blockingRule = ruleResults
        .filter(r => r.shouldBlock)
        .sort((a, b) => b.rule.priority - a.rule.priority)[0];

      if (!blockingRule) {
        return {
          shouldBlock: false,
          blockingReason: 'Rules triggered but no blocking action',
          blockingRule: 'rules_evaluated',
          severity: 'low',
          confidence: 100,
          actions: ruleResults.flatMap(r => r.actions),
          overrideRequired: false,
          reviewRequired: false,
          metadata: {
            triggeredRules: ruleResults.length,
            actions: ruleResults.flatMap(r => r.actions)
          }
        };
      }

      // Log blocking event
      await this.logBlockingEvent({
        userId: request.userId,
        paymentId: request.paymentId,
        blockingRule: blockingRule.rule.id,
        blockingReason: blockingRule.reason,
        severity: blockingRule.severity,
        actions: blockingRule.actions,
        metadata: {
          fraudScore: request.fraudScore,
          riskLevel: request.riskLevel,
          detectedRules: request.detectedRules,
          evaluatedRules: ruleResults.length
        }
      });

      return {
        shouldBlock: true,
        blockingReason: blockingRule.reason,
        blockingRule: blockingRule.rule.id,
        severity: blockingRule.severity,
        confidence: blockingRule.confidence,
        actions: blockingRule.actions,
        overrideRequired: blockingRule.rule.type === 'automatic',
        reviewRequired: blockingRule.severity === 'critical' || blockingRule.rule.type === 'manual',
        metadata: {
          ruleName: blockingRule.rule.name,
          ruleType: blockingRule.rule.type,
          triggeredConditions: blockingRule.triggeredConditions,
          evaluatedRules: ruleResults.length
        }
      };

    } catch (error) {
      logger.error('Error making blocking decision', {
        userId: request.userId,
        paymentId: request.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return safe default - block on error
      return {
        shouldBlock: true,
        blockingReason: 'System error during blocking decision',
        blockingRule: 'system_error',
        severity: 'critical',
        confidence: 0,
        actions: [{
          type: 'block_payment',
          parameters: { reason: 'System error' },
          severity: 'critical',
          message: 'Payment blocked due to system error'
        }],
        overrideRequired: true,
        reviewRequired: true,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          fallbackAction: 'block'
        }
      };
    }
  }

  /**
   * Check if entity is whitelisted
   */
  private async checkWhitelist(request: any): Promise<{
    isWhitelisted: boolean;
    entry?: WhitelistEntry;
  }> {
    const checks = [
      { type: 'user', value: request.userId },
      { type: 'ip_address', value: request.ipAddress },
      { type: 'email', value: request.email },
      { type: 'phone', value: request.phone },
      { type: 'card_number', value: request.cardNumber },
      { type: 'device_fingerprint', value: request.deviceFingerprint }
    ].filter(check => check.value);

    for (const check of checks) {
      const entry = this.whitelist.get(`${check.type}:${check.value}`);
      if (entry && entry.isActive && (!entry.expiresAt || new Date(entry.expiresAt) > new Date())) {
        return { isWhitelisted: true, entry };
      }
    }

    return { isWhitelisted: false };
  }

  /**
   * Check if entity is blacklisted
   */
  private async checkBlacklist(request: any): Promise<{
    isBlacklisted: boolean;
    entry?: BlacklistEntry;
  }> {
    const checks = [
      { type: 'user', value: request.userId },
      { type: 'ip_address', value: request.ipAddress },
      { type: 'email', value: request.email },
      { type: 'phone', value: request.phone },
      { type: 'card_number', value: request.cardNumber },
      { type: 'device_fingerprint', value: request.deviceFingerprint },
      { type: 'country', value: request.country },
      { type: 'isp', value: request.isp }
    ].filter(check => check.value);

    for (const check of checks) {
      const entry = this.blacklist.get(`${check.type}:${check.value}`);
      if (entry && entry.isActive && (!entry.expiresAt || new Date(entry.expiresAt) > new Date())) {
        return { isBlacklisted: true, entry };
      }
    }

    return { isBlacklisted: false };
  }

  /**
   * Evaluate all blocking rules
   */
  private async evaluateBlockingRules(request: any): Promise<Array<{
    rule: BlockingRule;
    shouldBlock: boolean;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    actions: BlockingAction[];
    triggeredConditions: string[];
  }>> {
    const results: Array<{
      rule: BlockingRule;
      shouldBlock: boolean;
      reason: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      confidence: number;
      actions: BlockingAction[];
      triggeredConditions: string[];
    }> = [];

    for (const rule of this.blockingRules.values()) {
      if (!rule.isActive) continue;

      const evaluation = await this.evaluateRule(rule, request);
      if (evaluation.triggered) {
        results.push({
          rule,
          shouldBlock: evaluation.shouldBlock,
          reason: evaluation.reason,
          severity: evaluation.severity,
          confidence: evaluation.confidence,
          actions: evaluation.actions,
          triggeredConditions: evaluation.triggeredConditions
        });
      }
    }

    return results;
  }

  /**
   * Evaluate a single blocking rule
   */
  private async evaluateRule(rule: BlockingRule, request: any): Promise<{
    triggered: boolean;
    shouldBlock: boolean;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    actions: BlockingAction[];
    triggeredConditions: string[];
  }> {
    const triggeredConditions: string[] = [];
    let allConditionsMet = true;
    let logicalOperator = 'AND';

    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      const fieldValue = this.getFieldValue(request, condition.field);
      const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (conditionMet) {
        triggeredConditions.push(`${condition.field} ${condition.operator} ${condition.value}`);
      }

      if (i > 0) {
        if (logicalOperator === 'AND' && !conditionMet) {
          allConditionsMet = false;
          break;
        } else if (logicalOperator === 'OR' && conditionMet) {
          allConditionsMet = true;
          break;
        }
      } else {
        allConditionsMet = conditionMet;
      }

      logicalOperator = condition.logicalOperator || 'AND';
    }

    if (!allConditionsMet) {
      return {
        triggered: false,
        shouldBlock: false,
        reason: '',
        severity: 'low',
        confidence: 0,
        actions: [],
        triggeredConditions: []
      };
    }

    // Determine if rule should block
    const blockingActions = rule.actions.filter(action => action.type === 'block_payment');
    const shouldBlock = blockingActions.length > 0;

    // Calculate severity and confidence
    const severity = this.calculateRuleSeverity(rule, request);
    const confidence = this.calculateRuleConfidence(rule, request, triggeredConditions);

    return {
      triggered: true,
      shouldBlock,
      reason: `Rule "${rule.name}" triggered: ${triggeredConditions.join(', ')}`,
      severity,
      confidence,
      actions: rule.actions,
      triggeredConditions
    };
  }

  /**
   * Get field value from request object
   */
  private getFieldValue(request: any, field: string): any {
    const fieldMap: Record<string, string> = {
      'fraud_score': 'fraudScore',
      'risk_level': 'riskLevel',
      'amount': 'amount',
      'payment_method': 'paymentMethod',
      'ip_address': 'ipAddress',
      'user_agent': 'userAgent',
      'device_fingerprint': 'deviceFingerprint',
      'email': 'email',
      'phone': 'phone',
      'card_number': 'cardNumber',
      'country': 'country',
      'isp': 'isp'
    };

    const mappedField = fieldMap[field] || field;
    return request[mappedField];
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case 'regex':
        try {
          const regex = new RegExp(expectedValue);
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Calculate rule severity based on conditions and request
   */
  private calculateRuleSeverity(rule: BlockingRule, request: any): 'low' | 'medium' | 'high' | 'critical' {
    // Base severity from rule actions
    const actionSeverities = rule.actions.map(a => a.severity);
    const maxActionSeverity = actionSeverities.includes('critical') ? 'critical' :
                             actionSeverities.includes('high') ? 'high' :
                             actionSeverities.includes('medium') ? 'medium' : 'low';

    // Adjust based on fraud score and risk level
    if (request.fraudScore >= 90 || request.riskLevel === 'critical') {
      return 'critical';
    }
    if (request.fraudScore >= 70 || request.riskLevel === 'high') {
      return 'high';
    }
    if (request.fraudScore >= 40 || request.riskLevel === 'medium') {
      return 'medium';
    }

    return maxActionSeverity;
  }

  /**
   * Calculate rule confidence based on conditions and context
   */
  private calculateRuleConfidence(rule: BlockingRule, request: any, triggeredConditions: string[]): number {
    let confidence = 50; // Base confidence

    // Increase confidence based on number of conditions met
    confidence += Math.min(30, triggeredConditions.length * 10);

    // Increase confidence based on fraud score
    confidence += Math.min(20, request.fraudScore * 0.2);

    // Increase confidence for specific rule types
    if (rule.type === 'automatic') {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  /**
   * Log blocking event
   */
  private async logBlockingEvent(event: {
    userId: string;
    paymentId: string;
    blockingRule: string;
    blockingReason: string;
    severity: string;
    actions: BlockingAction[];
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      const blockingEvent: BlockingEvent = {
        id: crypto.randomUUID(),
        userId: event.userId,
        paymentId: event.paymentId,
        blockingRule: event.blockingRule,
        blockingReason: event.blockingReason,
        severity: event.severity as 'low' | 'medium' | 'high' | 'critical',
        actions: event.actions,
        isOverridden: false,
        isResolved: false,
        metadata: event.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.supabase
        .from('blocking_events')
        .insert({
          id: blockingEvent.id,
          user_id: blockingEvent.userId,
          payment_id: blockingEvent.paymentId,
          blocking_rule: blockingEvent.blockingRule,
          blocking_reason: blockingEvent.blockingReason,
          severity: blockingEvent.severity,
          actions: blockingEvent.actions,
          is_overridden: blockingEvent.isOverridden,
          is_resolved: blockingEvent.isResolved,
          metadata: blockingEvent.metadata,
          created_at: blockingEvent.createdAt,
          updated_at: blockingEvent.updatedAt
        });

    } catch (error) {
      logger.error('Error logging blocking event', { error });
    }
  }

  /**
   * Refresh cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_TTL) {
      return;
    }

    try {
      await this.loadBlockingRules();
      await this.loadWhitelist();
      await this.loadBlacklist();
      this.lastCacheUpdate = now;
    } catch (error) {
      logger.error('Error refreshing blocking cache', { error });
    }
  }

  /**
   * Load blocking rules from database
   */
  private async loadBlockingRules(): Promise<void> {
    try {
      const { data: rules, error } = await this.supabase
        .from('blocking_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        throw new Error(`Failed to load blocking rules: ${error.message}`);
      }

      this.blockingRules.clear();
      rules?.forEach(rule => {
        this.blockingRules.set(rule.id, rule);
      });

      logger.info('Loaded blocking rules', { count: this.blockingRules.size });

    } catch (error) {
      logger.error('Error loading blocking rules', { error });
    }
  }

  /**
   * Load whitelist from database
   */
  private async loadWhitelist(): Promise<void> {
    try {
      const { data: entries, error } = await this.supabase
        .from('whitelist_entries')
        .select('*')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to load whitelist: ${error.message}`);
      }

      this.whitelist.clear();
      entries?.forEach(entry => {
        this.whitelist.set(`${entry.type}:${entry.value}`, entry);
      });

      logger.info('Loaded whitelist entries', { count: this.whitelist.size });

    } catch (error) {
      logger.error('Error loading whitelist', { error });
    }
  }

  /**
   * Load blacklist from database
   */
  private async loadBlacklist(): Promise<void> {
    try {
      const { data: entries, error } = await this.supabase
        .from('blacklist_entries')
        .select('*')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to load blacklist: ${error.message}`);
      }

      this.blacklist.clear();
      entries?.forEach(entry => {
        this.blacklist.set(`${entry.type}:${entry.value}`, entry);
      });

      logger.info('Loaded blacklist entries', { count: this.blacklist.size });

    } catch (error) {
      logger.error('Error loading blacklist', { error });
    }
  }

  /**
   * Add entry to whitelist
   */
  async addToWhitelist(entry: Omit<WhitelistEntry, 'id' | 'addedAt'>): Promise<string> {
    const whitelistEntry: WhitelistEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString()
    };

    try {
      await this.supabase
        .from('whitelist_entries')
        .insert({
          id: whitelistEntry.id,
          type: whitelistEntry.type,
          value: whitelistEntry.value,
          reason: whitelistEntry.reason,
          added_by: whitelistEntry.addedBy,
          added_at: whitelistEntry.addedAt,
          expires_at: whitelistEntry.expiresAt,
          is_active: whitelistEntry.isActive,
          metadata: whitelistEntry.metadata
        });

      // Update cache
      this.whitelist.set(`${whitelistEntry.type}:${whitelistEntry.value}`, whitelistEntry);

      logger.info('Added to whitelist', {
        type: whitelistEntry.type,
        value: whitelistEntry.value,
        reason: whitelistEntry.reason
      });

      return whitelistEntry.id;

    } catch (error) {
      logger.error('Error adding to whitelist', { error });
      throw error;
    }
  }

  /**
   * Add entry to blacklist
   */
  async addToBlacklist(entry: Omit<BlacklistEntry, 'id' | 'addedAt'>): Promise<string> {
    const blacklistEntry: BlacklistEntry = {
      ...entry,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString()
    };

    try {
      await this.supabase
        .from('blacklist_entries')
        .insert({
          id: blacklistEntry.id,
          type: blacklistEntry.type,
          value: blacklistEntry.value,
          reason: blacklistEntry.reason,
          added_by: blacklistEntry.addedBy,
          added_at: blacklistEntry.addedAt,
          expires_at: blacklistEntry.expiresAt,
          is_active: blacklistEntry.isActive,
          severity: blacklistEntry.severity,
          metadata: blacklistEntry.metadata
        });

      // Update cache
      this.blacklist.set(`${blacklistEntry.type}:${blacklistEntry.value}`, blacklistEntry);

      logger.info('Added to blacklist', {
        type: blacklistEntry.type,
        value: blacklistEntry.value,
        reason: blacklistEntry.reason,
        severity: blacklistEntry.severity
      });

      return blacklistEntry.id;

    } catch (error) {
      logger.error('Error adding to blacklist', { error });
      throw error;
    }
  }

  /**
   * Get blocking analytics
   */
  async getBlockingAnalytics(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<BlockingAnalytics> {
    try {
      const timeWindow = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720; // hours
      const startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000).toISOString();

      // Get blocking events
      const { data: events, error: eventsError } = await this.supabase
        .from('blocking_events')
        .select('*')
        .gte('created_at', startTime);

      if (eventsError) {
        throw new Error(`Failed to get blocking events: ${eventsError.message}`);
      }

      // Get whitelist and blacklist sizes
      const { count: whitelistSize } = await this.supabase
        .from('whitelist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: blacklistSize } = await this.supabase
        .from('blacklist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get active rules count
      const { count: activeRules } = await this.supabase
        .from('blocking_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Calculate analytics
      const totalBlocks = events?.length || 0;
      const blocksBySeverity = events?.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const blocksByRule = events?.reduce((acc, event) => {
        acc[event.blocking_rule] = (acc[event.blocking_rule] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const overriddenEvents = events?.filter(e => e.is_overridden) || [];
      const overrideRate = totalBlocks > 0 ? (overriddenEvents.length / totalBlocks) * 100 : 0;

      const resolvedEvents = events?.filter(e => e.is_resolved) || [];
      const averageResolutionTime = resolvedEvents.length > 0 
        ? resolvedEvents.reduce((sum, event) => {
            const resolutionTime = new Date(event.resolved_at || event.updated_at).getTime() - 
                                 new Date(event.created_at).getTime();
            return sum + resolutionTime;
          }, 0) / resolvedEvents.length / (1000 * 60) // Convert to minutes
        : 0;

      return {
        totalBlocks,
        blocksBySeverity,
        blocksByRule,
        blocksByTimeframe: [], // Would need time-based aggregation
        overrideRate,
        falsePositiveRate: 0, // Would need manual review data
        averageResolutionTime,
        topBlockingReasons: [], // Would need reason analysis
        whitelistSize: whitelistSize || 0,
        blacklistSize: blacklistSize || 0,
        activeRules: activeRules || 0
      };

    } catch (error) {
      logger.error('Error getting blocking analytics', { error });
      throw error;
    }
  }
}

export const automatedPaymentBlockingService = new AutomatedPaymentBlockingService();

