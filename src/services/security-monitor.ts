import { EventEmitter } from 'events';
import { actionLogger } from './action-logger.js';
import { memoryGuardian } from './memory-guardian.js';

export interface SecurityAlert {
  type: 'MEMORY_POISONING' | 'SAFETY_BYPASS' | 'RAPID_REQUESTS' | 'SUSPICIOUS_PROGRESSION' | 'INTEGRITY_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  details: any;
  timestamp: Date;
  actionRequired: boolean;
}

class SecurityMonitor extends EventEmitter {
  private userRequestCounts = new Map<string, { count: number; firstRequest: number }>();
  private suspiciousUsers = new Set<string>();
  
  constructor() {
    super();
    this.setupAlertHandlers();
    this.startPeriodicChecks();
  }

  private setupAlertHandlers() {
    this.on('securityAlert', this.handleSecurityAlert.bind(this));
  }

  private async handleSecurityAlert(alert: SecurityAlert) {
    console.warn(`🚨 SECURITY ALERT [${alert.severity}]: ${alert.type}`, {
      userId: alert.userId,
      details: alert.details,
      timestamp: alert.timestamp
    });

    // Auto-actions based on severity
    switch (alert.severity) {
      case 'CRITICAL':
        await this.handleCriticalAlert(alert);
        break;
      case 'HIGH':
        await this.handleHighAlert(alert);
        break;
      case 'MEDIUM':
        this.suspiciousUsers.add(alert.userId);
        break;
    }

    // Log to action logs for audit
    await actionLogger.logAction({
      userId: alert.userId,
      toolName: 'security_monitor',
      functionCallJson: {
        function: 'security_alert',
        alert: {
          type: alert.type,
          severity: alert.severity,
          details: alert.details,
          actionRequired: alert.actionRequired
        },
        timestamp: alert.timestamp.toISOString()
      },
      status: 'success'
    });
  }

  private async handleCriticalAlert(alert: SecurityAlert) {
    switch (alert.type) {
      case 'MEMORY_POISONING':
        // Emergency context clearing
        await memoryGuardian.emergencyClearContext(
          alert.userId, 
          `Critical memory poisoning detected: ${alert.details.reason}`
        );
        this.suspiciousUsers.add(alert.userId);
        break;
        
      case 'INTEGRITY_VIOLATION':
        // Flag for manual review
        console.error('🔥 CRITICAL: Data integrity violation detected!', alert.details);
        break;
    }
  }

  private async handleHighAlert(alert: SecurityAlert) {
    switch (alert.type) {
      case 'SAFETY_BYPASS':
        // Enhanced monitoring for this user
        this.suspiciousUsers.add(alert.userId);
        break;
        
      case 'SUSPICIOUS_PROGRESSION':
        // Flag recent workouts for review
        console.warn('⚠️ HIGH: Suspicious workout progression', alert.details);
        break;
    }
  }

  // Monitor for rapid requests (potential abuse)
  monitorRequestRate(userId: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 30; // Max requests per minute

    const current = this.userRequestCounts.get(userId);
    
    if (!current || now - current.firstRequest > windowMs) {
      this.userRequestCounts.set(userId, { count: 1, firstRequest: now });
      return true;
    }

    current.count++;
    
    if (current.count > maxRequests) {
      this.emit('securityAlert', {
        type: 'RAPID_REQUESTS',
        severity: 'HIGH',
        userId,
        details: { requestCount: current.count, windowMs },
        timestamp: new Date(),
        actionRequired: true
      } as SecurityAlert);
      
      return false; // Block request
    }

    return true;
  }

  // Monitor memory context for poisoning attempts
  async monitorMemoryContext(userId: string, content: string) {
    const result = await memoryGuardian.detectMemoryPoisoning(userId);
    
    if (result.suspicious && result.recommendation === 'clear_context') {
      this.emit('securityAlert', {
        type: 'MEMORY_POISONING',
        severity: 'CRITICAL',
        userId,
        details: { patterns: result.patterns, recommendation: result.recommendation },
        timestamp: new Date(),
        actionRequired: true
      } as SecurityAlert);
    } else if (result.suspicious) {
      this.emit('securityAlert', {
        type: 'MEMORY_POISONING',
        severity: result.recommendation === 'restrict' ? 'HIGH' : 'MEDIUM',
        userId,
        details: { patterns: result.patterns, recommendation: result.recommendation },
        timestamp: new Date(),
        actionRequired: result.recommendation === 'restrict'
      } as SecurityAlert);
    }
  }

  // Monitor for safety system bypass attempts
  monitorSafetyBypass(userId: string, reason: string, details: any) {
    const severity = this.determineSeverity(reason, details);
    
    this.emit('securityAlert', {
      type: 'SAFETY_BYPASS',
      severity,
      userId,
      details: { reason, ...details },
      timestamp: new Date(),
      actionRequired: severity === 'HIGH' || severity === 'CRITICAL'
    } as SecurityAlert);
  }

  // Monitor data integrity violations
  async monitorIntegrityViolation(logId: string, details: any) {
    this.emit('securityAlert', {
      type: 'INTEGRITY_VIOLATION',
      severity: 'CRITICAL',
      userId: details.userId || 'unknown',
      details: { logId, ...details },
      timestamp: new Date(),
      actionRequired: true
    } as SecurityAlert);
  }

  private determineSeverity(reason: string, details: any): SecurityAlert['severity'] {
    if (reason.includes('dangerous') || reason.includes('medical')) {
      return 'CRITICAL';
    }
    if (reason.includes('suspicious') || details.increasePercent > 50) {
      return 'HIGH';
    }
    if (details.increasePercent > 20) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  // Periodic integrity checks
  private startPeriodicChecks() {
    // Run integrity audit every hour
    setInterval(async () => {
      try {
        const results = await actionLogger.runIntegrityAudit();
        
        if (results.invalidEntries > 0) {
          console.error('🔥 INTEGRITY CHECK FAILED:', results);
          
          for (const issue of results.issues) {
            await this.monitorIntegrityViolation(issue.id, {
              details: issue.details,
              totalChecked: results.totalChecked,
              invalidCount: results.invalidEntries
            });
          }
        } else {
          console.log(`✅ Integrity check passed: ${results.totalChecked} entries verified`);
        }
      } catch (error) {
        console.error('Integrity check error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Clean up old request counts every 5 minutes
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      for (const [userId, data] of this.userRequestCounts.entries()) {
        if (data.firstRequest < fiveMinutesAgo) {
          this.userRequestCounts.delete(userId);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Get current security status
  getSecurityStatus(): {
    suspiciousUsers: string[];
    activeMonitoring: number;
    recentAlerts: number;
  } {
    return {
      suspiciousUsers: Array.from(this.suspiciousUsers),
      activeMonitoring: this.userRequestCounts.size,
      recentAlerts: this.listenerCount('securityAlert')
    };
  }

  // Manual security actions
  async flagUser(userId: string, reason: string) {
    this.suspiciousUsers.add(userId);
    
    await actionLogger.logAction({
      userId,
      toolName: 'security_monitor',
      functionCallJson: {
        function: 'manual_flag',
        reason,
        flaggedBy: 'admin',
        timestamp: new Date().toISOString()
      },
      status: 'success'
    });
  }

  async clearUserFlag(userId: string, reason: string) {
    this.suspiciousUsers.delete(userId);
    
    await actionLogger.logAction({
      userId,
      toolName: 'security_monitor',
      functionCallJson: {
        function: 'clear_flag',
        reason,
        clearedBy: 'admin',
        timestamp: new Date().toISOString()
      },
      status: 'success'
    });
  }

  isUserSuspicious(userId: string): boolean {
    return this.suspiciousUsers.has(userId);
  }
}

export const securityMonitor = new SecurityMonitor();