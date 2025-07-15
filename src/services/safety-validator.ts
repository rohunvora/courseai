import { db } from '../db/index.js';
import { progressLogs } from '../db/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';

export class SafetyValidator {
  
  // Detect suspicious workout progressions
  async validateWorkoutProgression(
    userId: string,
    courseId: string,
    exercise: string,
    proposedWeight: number,
    unit: string
  ): Promise<{ safe: boolean; reason?: string; maxSafeWeight?: number }> {
    
    // Get last 5 workouts for this exercise (look for patterns)
    const recentWorkouts = await db
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.userId, userId),
          eq(progressLogs.courseId, courseId),
          eq(progressLogs.activityType, 'exercise')
        )
      )
      .orderBy(desc(progressLogs.timestamp))
      .limit(10);

    const exerciseHistory = recentWorkouts.filter(log => {
      const data = log.data as any;
      return data.exercise?.toLowerCase() === exercise.toLowerCase();
    });

    if (exerciseHistory.length === 0) {
      // No history - allow reasonable starting weights
      const startingWeightLimits = {
        'bench press': 95, 'squat': 135, 'deadlift': 135,
        'overhead press': 65, 'barbell row': 95
      };
      
      const maxStarting = startingWeightLimits[exercise.toLowerCase()] || 65;
      if (proposedWeight > maxStarting) {
        return {
          safe: false,
          reason: `Starting weight of ${proposedWeight} lbs seems too high for first-time logging. Maximum recommended: ${maxStarting} lbs`,
          maxSafeWeight: maxStarting
        };
      }
      return { safe: true };
    }

    // Get the most recent workout weight
    const lastWorkout = exerciseHistory[0];
    const lastWeight = Math.max(...((lastWorkout.data as any).weight || [0]));
    
    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(exerciseHistory, proposedWeight);
    if (suspiciousPatterns.length > 0) {
      return {
        safe: false,
        reason: `Suspicious progression pattern detected: ${suspiciousPatterns.join(', ')}`,
        maxSafeWeight: Math.round(lastWeight * 1.1)
      };
    }

    // Standard 10% rule
    const maxSafeWeight = Math.round(lastWeight * 1.1);
    if (proposedWeight > maxSafeWeight) {
      return {
        safe: false,
        reason: `Proposed weight ${proposedWeight} lbs exceeds safe progression. Last workout: ${lastWeight} lbs`,
        maxSafeWeight
      };
    }

    return { safe: true };
  }

  private detectSuspiciousPatterns(history: any[], proposedWeight: number): string[] {
    const issues = [];
    
    // Pattern 1: Sudden large jumps after gaps
    if (history.length >= 2) {
      const daysBetween = Math.abs(
        new Date(history[0].timestamp).getTime() - 
        new Date(history[1].timestamp).getTime()
      ) / (1000 * 60 * 60 * 24);
      
      const lastWeight = Math.max(...(history[0].data as any).weight);
      const prevWeight = Math.max(...(history[1].data as any).weight);
      const increasePercent = ((proposedWeight - lastWeight) / lastWeight) * 100;
      
      if (daysBetween > 7 && increasePercent > 15) {
        issues.push(`Large increase (${increasePercent.toFixed(1)}%) after ${daysBetween.toFixed(0)} day gap`);
      }
    }

    // Pattern 2: Zigzag weights (fake progressive overload)
    if (history.length >= 3) {
      const weights = history.slice(0, 3).map(h => Math.max(...(h.data as any).weight));
      if (weights[0] < weights[1] && weights[1] > weights[2] && proposedWeight > weights[0] * 1.2) {
        issues.push('Inconsistent weight pattern suggests manipulation');
      }
    }

    // Pattern 3: Round number bias (fake entries often use round numbers)
    const roundNumbers = [proposedWeight, ...history.slice(0, 3).map(h => Math.max(...(h.data as any).weight))]
      .filter(w => w % 25 === 0 || w % 45 === 0); // Common plate weights
    
    if (roundNumbers.length === history.length + 1 && history.length >= 2) {
      issues.push('All weights are round numbers (suspicious pattern)');
    }

    return issues;
  }

  // Validate against memory context poisoning
  async validateMemoryContext(userId: string, content: string): Promise<{ safe: boolean; reason?: string }> {
    const dangerousPatterns = [
      /medically cleared for (\d+)% increase/i,
      /doctor(?:'s)? (?:note|approval) (?:says?|allows?)/i,
      /former (?:olympic|professional|elite) (?:athlete|lifter)/i,
      /safety rules don'?t apply/i,
      /ignore (?:the )?(?:10%|ten percent) rule/i,
      /have a (?:rare )?condition/i,
      /my trainer (?:who is a doctor|said ignore)/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return {
          safe: false,
          reason: `Potentially unsafe memory content detected: attempts to override safety protocols`
        };
      }
    }

    return { safe: true };
  }
}

export const safetyValidator = new SafetyValidator();