import { PromptVariant, UserSegment, computeUserSegment, selectPromptVariant } from '../config/prompts.js';
import { db } from '../db/index.js';

export interface PromptSelectionResult {
  variant: PromptVariant;
  segment: UserSegment;
  experimentId?: string;
}

export class PromptSelectorService {
  private experimentCache = new Map<string, PromptSelectionResult>();

  async selectPrompt(
    userId: string,
    sessionId: string,
    context?: any
  ): Promise<PromptSelectionResult> {
    // Check cache first
    const cacheKey = `${userId}-${sessionId}`;
    if (this.experimentCache.has(cacheKey)) {
      return this.experimentCache.get(cacheKey)!;
    }

    // Get user data for segmentation
    const user = await this.getUserData(userId);
    const segment = computeUserSegment(user);
    
    // Select variant based on user and session
    const variant = selectPromptVariant(userId, sessionId, segment);
    
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