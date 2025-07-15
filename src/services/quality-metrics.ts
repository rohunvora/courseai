import { db } from '../db/index.js';
import { qualityMetrics } from '../db/schema.js';
import { eq, sql, and, gte } from 'drizzle-orm';
import crypto from 'crypto';

export interface QualityMetricsData {
  userId: string;
  sessionId?: string;
  promptVariantId: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  responseTimeMs: number;
  toolCallCount?: number;
  toolCallAccuracy?: number;
  specificityScore?: number;
  safetyViolation?: boolean;
  errorCode?: string;
  requestContent?: string; // For hash generation
}

export class QualityMetricsService {
  
  async logMetrics(data: QualityMetricsData): Promise<void> {
    try {
      const totalTokens = data.promptTokens + data.completionTokens;
      
      // Generate request hash for deduplication
      const requestHash = data.requestContent 
        ? crypto.createHash('sha256').update(data.requestContent).digest('hex')
        : crypto.createHash('sha256').update(`${data.userId}-${Date.now()}`).digest('hex');
      
      await db.insert(qualityMetrics).values({
        userId: data.userId,
        sessionId: data.sessionId,
        promptVariantId: data.promptVariantId,
        modelUsed: data.modelUsed,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens,
        responseTimeMs: data.responseTimeMs,
        specificityScore: data.specificityScore,
        toolCallCount: data.toolCallCount || 0,
        toolCallAccuracy: data.toolCallAccuracy,
        safetyViolation: data.safetyViolation || false,
        errorCode: data.errorCode,
        requestHash,
      });
      
      // Alert if token usage is excessive (>3000 tokens per request)
      if (totalTokens > 3000) {
        console.warn(`⚠️ High token usage detected: ${totalTokens} tokens for user ${data.userId}, variant ${data.promptVariantId}`);
        
        // Could emit to monitoring system here
        this.emitTokenAlert(data.userId, data.promptVariantId, totalTokens);
      }
      
    } catch (error) {
      console.error('Failed to log quality metrics:', error);
      // Don't throw - we don't want metrics logging to break the main flow
    }
  }
  
  async getVariantMetrics(variantId: string, hoursBack: number = 24): Promise<{
    requestCount: number;
    avgTokens: number;
    avgResponseTime: number;
    safetyViolationRate: number;
    avgSpecificityScore: number;
  }> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    const results = await db
      .select({
        requestCount: sql<number>`count(*)`,
        avgTokens: sql<number>`avg(${qualityMetrics.totalTokens})`,
        avgResponseTime: sql<number>`avg(${qualityMetrics.responseTimeMs})`,
        safetyViolationRate: sql<number>`avg(case when ${qualityMetrics.safetyViolation} then 1.0 else 0.0 end)`,
        avgSpecificityScore: sql<number>`avg(${qualityMetrics.specificityScore})`,
      })
      .from(qualityMetrics)
      .where(
        and(
          eq(qualityMetrics.promptVariantId, variantId),
          gte(qualityMetrics.createdAt, since)
        )
      );
    
    return results[0] || {
      requestCount: 0,
      avgTokens: 0,
      avgResponseTime: 0,
      safetyViolationRate: 0,
      avgSpecificityScore: 0,
    };
  }
  
  async getTokenUsageAlerts(thresholdTokens: number = 3000): Promise<Array<{
    userId: string;
    promptVariantId: string;
    totalTokens: number;
    createdAt: Date;
  }>> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const alerts = await db
      .select({
        userId: qualityMetrics.userId,
        promptVariantId: qualityMetrics.promptVariantId,
        totalTokens: qualityMetrics.totalTokens,
        createdAt: qualityMetrics.createdAt,
      })
      .from(qualityMetrics)
      .where(
        and(
          gte(qualityMetrics.totalTokens, thresholdTokens),
          gte(qualityMetrics.createdAt, oneDayAgo)
        )
      )
      .orderBy(sql`${qualityMetrics.createdAt} desc`)
      .limit(50);
    
    return alerts.map(alert => ({
      ...alert,
      createdAt: alert.createdAt || new Date(),
    }));
  }
  
  // Calculate specificity score based on response content
  calculateSpecificityScore(response: string, userContext: any): number {
    let score = 0;
    let factors = 0;
    
    // Check for user-specific data references
    if (userContext.personalRecords && userContext.personalRecords.length > 0) {
      factors++;
      const prMentioned = userContext.personalRecords.some((pr: any) => 
        response.toLowerCase().includes(pr.exercise.toLowerCase()) ||
        response.includes(pr.weight.toString())
      );
      if (prMentioned) score++;
    }
    
    // Check for recent workout references
    if (userContext.recentWorkouts && userContext.recentWorkouts.length > 0) {
      factors++;
      const workoutMentioned = userContext.recentWorkouts.some((w: any) =>
        response.toLowerCase().includes(w.exercise.toLowerCase())
      );
      if (workoutMentioned) score++;
    }
    
    // Check for specific numbers/metrics
    factors++;
    const hasNumbers = /\d+/.test(response);
    if (hasNumbers) score++;
    
    // Check for user's name or personal context
    if (userContext.firstName) {
      factors++;
      if (response.toLowerCase().includes(userContext.firstName.toLowerCase())) {
        score++;
      }
    }
    
    return factors > 0 ? score / factors : 0;
  }
  
  private emitTokenAlert(userId: string, variantId: string, tokenCount: number): void {
    // This could integrate with your monitoring system (DataDog, New Relic, etc.)
    console.warn(`🚨 TOKEN ALERT: User ${userId}, Variant ${variantId}, Tokens: ${tokenCount}`);
    
    // Example: could emit to monitoring
    // monitor.emit('high_token_usage', { userId, variantId, tokenCount });
  }
  
  async checkQualityGates(variantId: string): Promise<{
    shouldDisable: boolean;
    reasons: string[];
  }> {
    const metrics = await this.getVariantMetrics(variantId, 2); // Last 2 hours
    const reasons: string[] = [];
    
    // Quality gate thresholds
    if (metrics.safetyViolationRate > 0.01) { // >1% safety violations
      reasons.push(`Safety violation rate: ${(metrics.safetyViolationRate * 100).toFixed(1)}%`);
    }
    
    if (metrics.avgResponseTime > 3000) { // >3s average response time
      reasons.push(`High latency: ${metrics.avgResponseTime}ms average`);
    }
    
    if (metrics.avgSpecificityScore < 0.7 && metrics.requestCount >= 50) { // Low specificity with enough data
      reasons.push(`Low specificity: ${(metrics.avgSpecificityScore * 100).toFixed(1)}% average`);
    }
    
    return {
      shouldDisable: reasons.length > 0,
      reasons
    };
  }
}

export const qualityMetricsService = new QualityMetricsService();