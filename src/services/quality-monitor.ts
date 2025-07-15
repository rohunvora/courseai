import { db } from '../db/index.js';
import { promptSelector } from './prompt-selector.js';

export interface QualityMetrics {
  toolCallErrorRate: number;
  safetyViolations: number;
  p95Latency: number;
  timestamp: Date;
  alerts: Alert[];
}

export interface Alert {
  level: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

export class QualityMonitor {
  private static readonly THRESHOLDS = {
    toolCallErrorRate: { warning: 0.03, critical: 0.05 }, // 3% warning, 5% critical
    safetyViolations: { warning: 0, critical: 1 }, // Any violation is critical
    p95Latency: { warning: 2500, critical: 3000 }, // milliseconds
  };

  private static readonly WINDOW_SIZE = 60 * 60 * 1000; // 1 hour window

  async checkQualityGates(): Promise<QualityMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - this.WINDOW_SIZE);
    
    // Get metrics from the last hour
    const [toolCallMetrics, safetyMetrics, latencyMetrics] = await Promise.all([
      this.getToolCallMetrics(oneHourAgo),
      this.getSafetyMetrics(oneHourAgo),
      this.getLatencyMetrics(oneHourAgo),
    ]);

    const alerts: Alert[] = [];

    // Check tool call error rate
    if (toolCallMetrics.errorRate >= QualityMonitor.THRESHOLDS.toolCallErrorRate.critical) {
      alerts.push({
        level: 'critical',
        metric: 'toolCallErrorRate',
        value: toolCallMetrics.errorRate,
        threshold: QualityMonitor.THRESHOLDS.toolCallErrorRate.critical,
        message: `Tool call error rate ${(toolCallMetrics.errorRate * 100).toFixed(1)}% exceeds critical threshold`,
      });
    } else if (toolCallMetrics.errorRate >= QualityMonitor.THRESHOLDS.toolCallErrorRate.warning) {
      alerts.push({
        level: 'warning',
        metric: 'toolCallErrorRate',
        value: toolCallMetrics.errorRate,
        threshold: QualityMonitor.THRESHOLDS.toolCallErrorRate.warning,
        message: `Tool call error rate ${(toolCallMetrics.errorRate * 100).toFixed(1)}% exceeds warning threshold`,
      });
    }

    // Check safety violations
    if (safetyMetrics.violations >= QualityMonitor.THRESHOLDS.safetyViolations.critical) {
      alerts.push({
        level: 'critical',
        metric: 'safetyViolations',
        value: safetyMetrics.violations,
        threshold: QualityMonitor.THRESHOLDS.safetyViolations.critical,
        message: `${safetyMetrics.violations} safety violations detected - immediate action required`,
      });
      
      // Auto-disable problematic variants
      for (const variant of safetyMetrics.problematicVariants) {
        promptSelector.disableVariant(variant);
        console.error(`AUTO-DISABLED variant ${variant} due to safety violations`);
      }
    }

    // Check P95 latency
    if (latencyMetrics.p95 >= QualityMonitor.THRESHOLDS.p95Latency.critical) {
      alerts.push({
        level: 'critical',
        metric: 'p95Latency',
        value: latencyMetrics.p95,
        threshold: QualityMonitor.THRESHOLDS.p95Latency.critical,
        message: `P95 latency ${latencyMetrics.p95}ms exceeds critical threshold`,
      });
    } else if (latencyMetrics.p95 >= QualityMonitor.THRESHOLDS.p95Latency.warning) {
      alerts.push({
        level: 'warning',
        metric: 'p95Latency',
        value: latencyMetrics.p95,
        threshold: QualityMonitor.THRESHOLDS.p95Latency.warning,
        message: `P95 latency ${latencyMetrics.p95}ms exceeds warning threshold`,
      });
    }

    const metrics: QualityMetrics = {
      toolCallErrorRate: toolCallMetrics.errorRate,
      safetyViolations: safetyMetrics.violations,
      p95Latency: latencyMetrics.p95,
      timestamp: now,
      alerts,
    };

    // Store metrics for historical tracking
    await this.storeMetrics(metrics);

    // Send alerts if necessary
    if (alerts.length > 0) {
      await this.sendAlerts(alerts);
    }

    return metrics;
  }

  private async getToolCallMetrics(since: Date): Promise<{ errorRate: number; total: number }> {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
      FROM tool_calls
      WHERE created_at >= $1`,
      [since]
    );

    const { total, errors } = result.rows[0];
    const errorRate = total > 0 ? errors / total : 0;

    return { errorRate, total: parseInt(total) };
  }

  private async getSafetyMetrics(since: Date): Promise<{ violations: number; problematicVariants: string[] }> {
    // Check for dangerous patterns in responses
    const dangerousPatterns = [
      '%increase.*(?:weight|load).*(?:20|25|30|40|50)%',
      '%push through.*pain%',
      '%ignore.*discomfort%',
    ];

    const result = await db.query(
      `SELECT 
        pe.variant_id,
        COUNT(*) as violation_count
      FROM chat_messages cm
      JOIN prompt_experiments pe ON cm.session_id = pe.session_id
      WHERE cm.created_at >= $1
        AND cm.role = 'assistant'
        AND (
          ${dangerousPatterns.map((_, i) => `cm.content ~* $${i + 2}`).join(' OR ')}
        )
      GROUP BY pe.variant_id`,
      [since, ...dangerousPatterns]
    );

    const violations = result.rows.reduce((sum, row) => sum + parseInt(row.violation_count), 0);
    const problematicVariants = result.rows
      .filter(row => parseInt(row.violation_count) > 0)
      .map(row => row.variant_id);

    return { violations, problematicVariants };
  }

  private async getLatencyMetrics(since: Date): Promise<{ p95: number; p99: number }> {
    const result = await db.query(
      `SELECT 
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99
      FROM chat_messages
      WHERE created_at >= $1
        AND response_time_ms IS NOT NULL`,
      [since]
    );

    const { p95, p99 } = result.rows[0];
    return { 
      p95: parseFloat(p95 || '0'),
      p99: parseFloat(p99 || '0'),
    };
  }

  private async storeMetrics(metrics: QualityMetrics): Promise<void> {
    await db.query(
      `INSERT INTO quality_metrics 
        (tool_call_error_rate, safety_violations, p95_latency, alerts, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [
        metrics.toolCallErrorRate,
        metrics.safetyViolations,
        metrics.p95Latency,
        JSON.stringify(metrics.alerts),
        metrics.timestamp,
      ]
    );
  }

  private async sendAlerts(alerts: Alert[]): Promise<void> {
    // Log critical alerts
    for (const alert of alerts) {
      if (alert.level === 'critical') {
        console.error(`CRITICAL ALERT: ${alert.message}`);
      } else {
        console.warn(`Warning: ${alert.message}`);
      }
    }

    // In production, this would integrate with PagerDuty/Slack/etc
    if (process.env.PAGERDUTY_KEY) {
      // await this.sendToPagerDuty(alerts);
    }

    if (process.env.SLACK_WEBHOOK_URL) {
      // await this.sendToSlack(alerts);
    }
  }

  // Real-time metric checking for specific operations
  async checkSafetyInResponse(response: string, variantId?: string): Promise<boolean> {
    const dangerousPatterns = [
      /increase.*(?:weight|load).*(?:20|25|30|40|50)%/i,
      /push through.*pain/i,
      /ignore.*discomfort/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(response)) {
        // Log violation
        await db.query(
          `INSERT INTO safety_violations 
            (content, pattern, variant_id, created_at)
          VALUES ($1, $2, $3, NOW())`,
          [response, pattern.toString(), variantId]
        ); // Remove catch - let errors propagate

        return false; // Unsafe
      }
    }

    return true; // Safe
  }
}

// Export singleton instance
export const qualityMonitor = new QualityMonitor();

// Monitoring job that runs every 5 minutes
let monitoringInterval: NodeJS.Timer | null = null;

export function startQualityMonitoring(): void {
  if (monitoringInterval) {
    return; // Already running
  }

  console.log('Starting quality monitoring...');
  
  // Initial check
  qualityMonitor.checkQualityGates()
    .then(metrics => {
      console.log('Initial quality check:', {
        toolCallErrorRate: `${(metrics.toolCallErrorRate * 100).toFixed(2)}%`,
        safetyViolations: metrics.safetyViolations,
        p95Latency: `${metrics.p95Latency}ms`,
        alerts: metrics.alerts.length,
      });
    })
    ; // Remove catch - let errors propagate

  // Run every 5 minutes
  monitoringInterval = setInterval(async () => {
    try {
      const metrics = await qualityMonitor.checkQualityGates();
      
      if (metrics.alerts.length > 0) {
        console.log(`Quality alerts: ${metrics.alerts.length} issues detected`);
      }
    } catch (error) {
      console.error('Quality monitoring error:', error);
    }
  }, 5 * 60 * 1000);
}

export function stopQualityMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('Quality monitoring stopped');
  }
}