import { createHash } from 'crypto';
import { db } from '../db/index.js';
import { actionLogs } from '../db/schema.js';

export interface ActionLogEntry {
  userId: string;
  sessionId?: string;
  courseId?: string;
  toolName: string;
  functionCallJson: any; // Complete function call payload
  executionTimeMs?: number;
  status: 'success' | 'failed' | 'pending';
  errorCode?: string;
  requestId?: string;
}

export class ActionLogger {
  
  // Generate SHA-256 hash from JSON payload
  private generatePayloadHash(functionCallJson: any): string {
    const jsonString = JSON.stringify(functionCallJson, Object.keys(functionCallJson).sort());
    return createHash('sha256').update(jsonString, 'utf8').digest('hex');
  }

  // Log function call to immutable action_logs table
  async logAction(entry: ActionLogEntry): Promise<string> {
    try {
      // Validate payload size (prevent huge payloads)
      const jsonString = JSON.stringify(entry.functionCallJson);
      const sizeInBytes = new TextEncoder().encode(jsonString).length;
      const maxSize = 64 * 1024; // 64KB limit
      
      if (sizeInBytes > maxSize) {
        // Truncate large payloads but preserve structure
        const truncated = {
          ...entry.functionCallJson,
          _truncated: true,
          _originalSize: sizeInBytes,
          _truncatedAt: new Date().toISOString()
        };
        
        // If still too large, keep only essential fields
        if (JSON.stringify(truncated).length > maxSize) {
          entry.functionCallJson = {
            function: entry.functionCallJson.function,
            parameters: '[TRUNCATED - Too Large]',
            _truncated: true,
            _originalSize: sizeInBytes
          };
        } else {
          entry.functionCallJson = truncated;
        }
      }
      
      const payloadHash = this.generatePayloadHash(entry.functionCallJson);
      
      const [result] = await db
        .insert(actionLogs)
        .values({
          userId: entry.userId,
          sessionId: entry.sessionId,
          courseId: entry.courseId,
          toolName: entry.toolName,
          functionCallJson: entry.functionCallJson,
          executionTimeMs: entry.executionTimeMs,
          status: entry.status,
          errorCode: entry.errorCode,
          requestId: entry.requestId,
          payloadHash,
        })
        .returning({ id: actionLogs.id });

      return result.id;
    } catch (error) {
      console.error('Failed to log action:', error);
      throw error;
    }
  }

  // Verify payload integrity using SHA-256 hash
  async verifyIntegrity(logId: string): Promise<{ valid: boolean; details?: string }> {
    try {
      const [log] = await db
        .select()
        .from(actionLogs)
        .where(actionLogs.id.eq(logId))
        .limit(1);

      if (!log) {
        return { valid: false, details: 'Log entry not found' };
      }

      const computedHash = this.generatePayloadHash(log.functionCallJson);
      const valid = computedHash === log.payloadHash;
      
      return {
        valid,
        details: valid ? 'Hash matches' : `Hash mismatch: computed ${computedHash}, stored ${log.payloadHash}`
      };
    } catch (error) {
      return { valid: false, details: `Verification error: ${error}` };
    }
  }

  // Get action logs for audit (read-only)
  async getActionLogs(filters: {
    userId?: string;
    sessionId?: string;
    toolName?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    let query = db.select().from(actionLogs);
    
    // Apply filters
    const conditions = [];
    if (filters.userId) conditions.push(actionLogs.userId.eq(filters.userId));
    if (filters.sessionId) conditions.push(actionLogs.sessionId.eq(filters.sessionId));
    if (filters.toolName) conditions.push(actionLogs.toolName.eq(filters.toolName));
    if (filters.status) conditions.push(actionLogs.status.eq(filters.status));
    
    if (conditions.length > 0) {
      query = query.where(conditions.reduce((acc, condition) => acc.and(condition)));
    }
    
    // Order by creation time (most recent first)
    query = query.orderBy(actionLogs.createdAt.desc());
    
    // Apply pagination
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);
    
    return query;
  }

  // Audit helper - detect any potential tampering
  async runIntegrityAudit(userId?: string): Promise<{
    totalChecked: number;
    validEntries: number;
    invalidEntries: number;
    issues: Array<{ id: string; details: string }>;
  }> {
    const filters = userId ? { userId, limit: 1000 } : { limit: 1000 };
    const logs = await this.getActionLogs(filters);
    
    const results = {
      totalChecked: logs.length,
      validEntries: 0,
      invalidEntries: 0,
      issues: [] as Array<{ id: string; details: string }>
    };
    
    for (const log of logs) {
      const verification = await this.verifyIntegrity(log.id);
      if (verification.valid) {
        results.validEntries++;
      } else {
        results.invalidEntries++;
        results.issues.push({
          id: log.id,
          details: verification.details || 'Unknown integrity issue'
        });
      }
    }
    
    return results;
  }

  // Get action log statistics
  async getStatistics(userId?: string): Promise<{
    totalActions: number;
    actionsByTool: Record<string, number>;
    actionsByStatus: Record<string, number>;
    averageExecutionTime: number;
    recentActivity: number; // Last 24 hours
  }> {
    let baseQuery = db.select().from(actionLogs);
    if (userId) {
      baseQuery = baseQuery.where(actionLogs.userId.eq(userId));
    }
    
    const logs = await baseQuery;
    
    const actionsByTool: Record<string, number> = {};
    const actionsByStatus: Record<string, number> = {};
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let recentActivity = 0;
    
    for (const log of logs) {
      // Count by tool
      actionsByTool[log.toolName] = (actionsByTool[log.toolName] || 0) + 1;
      
      // Count by status
      actionsByStatus[log.status] = (actionsByStatus[log.status] || 0) + 1;
      
      // Execution time stats
      if (log.executionTimeMs) {
        totalExecutionTime += log.executionTimeMs;
        executionTimeCount++;
      }
      
      // Recent activity
      if (log.createdAt && log.createdAt > last24Hours) {
        recentActivity++;
      }
    }
    
    return {
      totalActions: logs.length,
      actionsByTool,
      actionsByStatus,
      averageExecutionTime: executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0,
      recentActivity
    };
  }
}

// Export singleton instance
export const actionLogger = new ActionLogger();