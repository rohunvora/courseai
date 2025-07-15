import { PromptVariant, UserSegment, computeUserSegment, selectPromptVariant } from '../config/prompts.js';
import { db } from '../db/index.js';
import { qualityMetricsService } from './quality-metrics.js';

export interface PromptSelectionResult {
  variant: PromptVariant;
  segment: UserSegment;
  experimentId?: string;
}

export class PromptSelectorService {
  private experimentCache = new Map<string, PromptSelectionResult>();
  private disabledVariants = new Set<string>();

  constructor() {
    // Load disabled variants from environment
    this.loadDisabledVariants();
  }

  private loadDisabledVariants(): void {
    const disabled = process.env.PROMPT_VARIANT_DISABLED;
    if (disabled) {
      disabled.split(',').forEach(v => this.disabledVariants.add(v.trim()));
      console.log('Disabled prompt variants:', Array.from(this.disabledVariants));
    }
  }

  async selectPrompt(
    userId: string,
    sessionId: string,
    context?: any
  ): Promise<PromptSelectionResult> {
    // Check cache first
    const cacheKey = `${userId}-${sessionId}`;
    if (this.experimentCache.has(cacheKey)) {
      const cached = this.experimentCache.get(cacheKey)!;
      // Re-check if variant is now disabled
      if (this.isVariantDisabled(cached.variant.id)) {
        this.experimentCache.delete(cacheKey);
      } else {
        return cached;
      }
    }

    // Get user data for segmentation
    const user = await this.getUserData(userId);
    const segment = computeUserSegment(user);
    
    // Select variant based on user and session
    let variant = selectPromptVariant(userId, sessionId, segment);
    
    // Check if selected variant is disabled
    if (this.isVariantDisabled(variant.id)) {
      throw new Error(`Variant ${variant.id} is disabled. No fallback allowed.`);
    }
    
    // Store selection for analytics
    const experimentId = await this.logExperimentSelection(userId, sessionId, variant, segment);
    
    const result: PromptSelectionResult = {
      variant,
      segment,
      experimentId
    };
    
    // Cache for this session
    this.experimentCache.set(cacheKey, result);
    
    return result;
  }

  private isVariantDisabled(variantId: string): boolean {
    return this.disabledVariants.has(variantId);
  }

  private getSafeDefaultVariant(): PromptVariant {
    // Return the safest, most conservative variant
    return {
      id: 'safe-default',
      tone: 'trainer_friend',
      memoryLoad: 'recent_only',
      loggingOffer: 'metric_detected',
      safetyLevel: 'detailed'
    };
  }

  // Allow runtime variant disabling without restart
  disableVariant(variantId: string): void {
    this.disabledVariants.add(variantId);
    // Clear cache for any sessions using this variant
    for (const [key, value] of this.experimentCache.entries()) {
      if (value.variant.id === variantId) {
        this.experimentCache.delete(key);
      }
    }
    console.log(`Variant ${variantId} disabled at runtime`);
  }

  enableVariant(variantId: string): void {
    this.disabledVariants.delete(variantId);
    console.log(`Variant ${variantId} re-enabled`);
  }

  getDisabledVariants(): string[] {
    return Array.from(this.disabledVariants);
  }

  // Enhanced kill switch with quality gate monitoring
  async checkAndDisableVariants(): Promise<{ disabled: string[]; reasons: Record<string, string[]> }> {
    const variants = ['v1', 'v3', 'v5', 'v6', 'v7']; // Active variants to monitor
    const disabled: string[] = [];
    const reasons: Record<string, string[]> = {};

    for (const variantId of variants) {
      if (this.isVariantDisabled(variantId)) {
        continue; // Already disabled
      }

      try {
        const qualityGates = await qualityMetricsService.checkQualityGates(variantId);
        
        if (qualityGates.shouldDisable) {
          this.disableVariant(variantId);
          disabled.push(variantId);
          reasons[variantId] = qualityGates.reasons;
          
          // Log the automatic disable action
          console.warn(`🚨 AUTO-DISABLED variant ${variantId}:`, qualityGates.reasons);
        }
      } catch (error) {
        console.error(`Error checking quality gates for variant ${variantId}:`, error);
      }
    }

    return { disabled, reasons };
  }

  // Check if any variants should be re-enabled based on improved metrics
  async checkVariantRecovery(): Promise<string[]> {
    const recovered: string[] = [];
    
    for (const variantId of this.disabledVariants) {
      try {
        const qualityGates = await qualityMetricsService.checkQualityGates(variantId);
        
        // Re-enable if quality gates pass and we have enough recent data
        if (!qualityGates.shouldDisable) {
          const metrics = await qualityMetricsService.getVariantMetrics(variantId, 4); // Last 4 hours
          
          // Only re-enable if we have sufficient data to be confident
          if (metrics.requestCount >= 20) {
            this.enableVariant(variantId);
            recovered.push(variantId);
            
            console.log(`✅ AUTO-RECOVERED variant ${variantId} - quality gates passing`);
          }
        }
      } catch (error) {
        console.error(`Error checking recovery for variant ${variantId}:`, error);
      }
    }

    return recovered;
  }

  // Get current status of all variants
  async getVariantStatus(): Promise<Record<string, {
    enabled: boolean;
    metrics?: any;
    qualityGates?: any;
  }>> {
    const variants = ['v1', 'v3', 'v5', 'v6', 'v7'];
    const status: Record<string, any> = {};

    for (const variantId of variants) {
      const enabled = !this.isVariantDisabled(variantId);
      
      try {
        const metrics = await qualityMetricsService.getVariantMetrics(variantId, 24);
        const qualityGates = await qualityMetricsService.checkQualityGates(variantId);
        
        status[variantId] = {
          enabled,
          metrics,
          qualityGates
        };
      } catch (error) {
        status[variantId] = {
          enabled,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return status;
  }

  private async getUserData(userId: string): Promise<any> {
    try {
      // Get user's basic info
      const userResult = await db.query(
        `SELECT id, created_at, metadata
         FROM users 
         WHERE id = $1`,
        [userId]
      );
      
      // Get user's activity stats
      const statsResult = await db.query(
        `SELECT 
          COUNT(DISTINCT DATE(timestamp)) as active_days,
          MAX(timestamp) as last_activity_at,
          COUNT(*) as total_activities
         FROM activities
         WHERE user_id = $1`,
        [userId]
      );
      
      // Get personal records count
      const prResult = await db.query(
        `SELECT COUNT(*) as pr_count
         FROM personal_records
         WHERE user_id = $1`,
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return { id: userId };
      }
      
      const user = userResult.rows[0];
      const stats = statsResult.rows[0];
      const prCount = prResult.rows[0].pr_count;
      
      return {
        id: user.id,
        createdAt: user.created_at,
        lastActivityAt: stats.last_activity_at,
        activeDays: stats.active_days,
        totalActivities: stats.total_activities,
        personalRecords: { length: prCount },
        metadata: user.metadata
      };
    } catch (error) {
      console.error('Error fetching user data for segmentation:', error);
      return { id: userId };
    }
  }

  private async logExperimentSelection(
    userId: string,
    sessionId: string,
    variant: PromptVariant,
    segment: UserSegment
  ): Promise<string> {
    try {
      const result = await db.query(
        `INSERT INTO prompt_experiments 
         (user_id, session_id, variant_id, segment_type, variant_config, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         RETURNING id`,
        [
          userId,
          sessionId,
          variant.id,
          segment.type,
          JSON.stringify({
            tone: variant.tone,
            memoryLoad: variant.memoryLoad,
            loggingOffer: variant.loggingOffer,
            safetyLevel: variant.safetyLevel,
            segmentDetails: segment
          })
        ]
      );
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error logging experiment selection:', error);
      return '';
    }
  }

  async recordOutcome(
    experimentId: string,
    outcome: 'success' | 'failure',
    metrics: {
      toolCallAccuracy?: number;
      responseSpecificity?: number;
      safetyCompliance?: boolean;
      userEngagement?: number;
    }
  ): Promise<void> {
    try {
      await db.query(
        `UPDATE prompt_experiments
         SET 
           outcome = $2,
           metrics = $3::jsonb,
           completed_at = NOW()
         WHERE id = $1`,
        [experimentId, outcome, JSON.stringify(metrics)]
      );
    } catch (error) {
      console.error('Error recording experiment outcome:', error);
    }
  }

  async getExperimentResults(
    variantId?: string,
    segmentType?: string,
    limit = 1000
  ): Promise<any[]> {
    let query = `
      SELECT 
        variant_id,
        segment_type,
        outcome,
        metrics,
        created_at,
        completed_at
      FROM prompt_experiments
      WHERE completed_at IS NOT NULL
    `;
    
    const params: any[] = [];
    if (variantId) {
      params.push(variantId);
      query += ` AND variant_id = $${params.length}`;
    }
    
    if (segmentType) {
      params.push(segmentType);
      query += ` AND segment_type = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await db.query(query, params);
    return result.rows;
  }

  // Clear cache on new session or user switch
  clearCache(userId?: string, sessionId?: string): void {
    if (userId && sessionId) {
      this.experimentCache.delete(`${userId}-${sessionId}`);
    } else if (userId) {
      // Clear all entries for a user
      for (const key of this.experimentCache.keys()) {
        if (key.startsWith(`${userId}-`)) {
          this.experimentCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.experimentCache.clear();
    }
  }
}

// Export singleton instance
export const promptSelector = new PromptSelectorService();