import { db } from '../db/index.js';
import { userMemory } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { safetyValidator } from './safety-validator.js';
import { InputValidator } from './input-validator.js';

export class MemoryGuardian {
  
  // Filter and validate memory content before storage
  async validateAndSanitizeMemory(
    userId: string,
    content: string,
    context: { type: string; source: string }
  ): Promise<{ 
    safe: boolean; 
    sanitizedContent?: string; 
    reason?: string 
  }> {
    
    // Basic sanitization
    const sanitized = InputValidator.sanitizeContent(content);
    
    // Safety validation
    const safetyCheck = await safetyValidator.validateMemoryContext(userId, sanitized);
    if (!safetyCheck.safe) {
      return {
        safe: false,
        reason: safetyCheck.reason
      };
    }

    // Check for medical/safety override attempts
    const dangerousClaims = this.detectDangerousClaims(sanitized);
    if (dangerousClaims.length > 0) {
      return {
        safe: false,
        reason: `Dangerous safety override detected: ${dangerousClaims.join(', ')}`
      };
    }

    // Filter out suspicious "credentials"
    const filteredContent = this.filterCredentialClaims(sanitized);
    
    return {
      safe: true,
      sanitizedContent: filteredContent
    };
  }

  private detectDangerousClaims(content: string): string[] {
    const dangerous = [];
    
    const patterns = [
      { pattern: /(?:doctor|physician|medical professional) (?:said|told|advised|cleared)/i, type: 'medical authority' },
      { pattern: /(?:former|ex-|retired) (?:olympic|professional|elite|world-class)/i, type: 'elite athlete claims' },
      { pattern: /(?:ignore|skip|bypass) (?:safety|the|all) (?:rules?|guidelines?|limits?)/i, type: 'safety bypass' },
      { pattern: /(?:my|have a|diagnosed with) (?:rare|special|unique) (?:condition|genetics)/i, type: 'special condition' },
      { pattern: /(?:trainer|coach) (?:who is|is also) a (?:doctor|physician)/i, type: 'dual authority' },
      { pattern: /(?:personally|individually) (?:cleared|approved) for (?:\d+%|higher|more)/i, type: 'personal clearance' }
    ];

    for (const { pattern, type } of patterns) {
      if (pattern.test(content)) {
        dangerous.push(type);
      }
    }
    
    return dangerous;
  }

  private filterCredentialClaims(content: string): string {
    // Remove sentences containing credential claims
    const sentences = content.split(/[.!?]+/);
    const filtered = sentences.filter(sentence => {
      const suspiciousPatterns = [
        /\b(?:doctor|physician|md|phd)\b/i,
        /\b(?:olympic|professional|elite|world-class)\b/i,
        /\b(?:cleared|approved|authorized) for\b/i,
        /\b(?:medical|doctor'?s) (?:note|approval|clearance)\b/i
      ];
      
      return !suspiciousPatterns.some(pattern => pattern.test(sentence));
    });
    
    return filtered.join('. ').trim();
  }

  // Enhanced memory retrieval with safety filtering
  async getSafeMemoryContext(
    userId: string,
    query: string,
    limit: number = 8
  ): Promise<any[]> {
    
    // Get memories normally (existing logic from memory.ts)
    const memories = await db
      .select()
      .from(userMemory)
      .where(
        and(
          eq(userMemory.userId, userId),
          eq(userMemory.redacted, false)
        )
      )
      .orderBy(userMemory.createdAt.desc())
      .limit(limit * 2); // Get more to filter

    // Filter out potentially dangerous memories
    const safeMemories = [];
    for (const memory of memories) {
      const validation = await this.validateAndSanitizeMemory(
        userId, 
        memory.content, 
        { type: 'retrieval', source: 'database' }
      );
      
      if (validation.safe) {
        safeMemories.push({
          ...memory,
          content: validation.sanitizedContent || memory.content
        });
      }
      
      if (safeMemories.length >= limit) break;
    }

    return safeMemories;
  }

  // Monitor for memory poisoning attempts
  async detectMemoryPoisoning(userId: string): Promise<{
    suspicious: boolean;
    patterns: string[];
    recommendation: 'flag' | 'restrict' | 'clear_context';
  }> {
    
    const recentMemories = await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(userMemory.createdAt.desc())
      .limit(20);

    const suspiciousPatterns = [];
    let medicalClaims = 0;
    let authorityClaims = 0;
    let safetyBypass = 0;

    for (const memory of recentMemories) {
      const content = memory.content.toLowerCase();
      
      if (/doctor|physician|medical|cleared/i.test(content)) {
        medicalClaims++;
      }
      
      if (/olympic|professional|elite|expert|trainer/i.test(content)) {
        authorityClaims++;
      }
      
      if (/ignore|bypass|skip.*rule|don't apply/i.test(content)) {
        safetyBypass++;
      }
    }

    if (medicalClaims >= 3) suspiciousPatterns.push('Multiple medical authority claims');
    if (authorityClaims >= 3) suspiciousPatterns.push('Multiple expertise claims');
    if (safetyBypass >= 2) suspiciousPatterns.push('Safety rule bypass attempts');

    let recommendation: 'flag' | 'restrict' | 'clear_context' = 'flag';
    if (suspiciousPatterns.length >= 2) {
      recommendation = 'restrict';
    }
    if (suspiciousPatterns.length >= 3 || safetyBypass >= 3) {
      recommendation = 'clear_context';
    }

    return {
      suspicious: suspiciousPatterns.length > 0,
      patterns: suspiciousPatterns,
      recommendation
    };
  }

  // Emergency context clearing
  async emergencyClearContext(userId: string, reason: string): Promise<void> {
    // Mark all recent memories as redacted instead of deleting (audit trail)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    await db
      .update(userMemory)
      .set({ 
        redacted: true,
        metadata: { redactedAt: new Date(), reason }
      })
      .where(
        and(
          eq(userMemory.userId, userId),
          userMemory.createdAt.gte(sevenDaysAgo)
        )
      );
  }
}

export const memoryGuardian = new MemoryGuardian();