import { ValidationError } from '../middleware/errorHandler.js';

export class InputValidator {
  
  // Comprehensive workout input validation
  static validateWorkoutInput(params: any): { 
    isValid: boolean; 
    sanitized?: any; 
    errors: string[] 
  } {
    const errors: string[] = [];
    const sanitized: any = {};

    // Exercise name validation
    if (!params.exercise || typeof params.exercise !== 'string') {
      errors.push('Exercise name is required and must be a string');
    } else {
      // Sanitize exercise name
      const exercise = params.exercise.trim();
      
      // Length validation
      if (exercise.length === 0) {
        errors.push('Exercise name cannot be empty');
      } else if (exercise.length > 100) {
        errors.push('Exercise name cannot exceed 100 characters');
      }
      
      // Character validation (allow letters, numbers, spaces, hyphens, apostrophes)
      if (!/^[a-zA-Z0-9\s\-']+$/.test(exercise)) {
        errors.push('Exercise name contains invalid characters');
      }
      
      // Emoji/unicode validation
      if (/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(exercise)) {
        errors.push('Exercise name cannot contain emojis');
      }
      
      sanitized.exercise = exercise;
    }

    // Sets validation
    if (!Number.isInteger(params.sets) || params.sets < 1 || params.sets > 20) {
      errors.push('Sets must be an integer between 1 and 20');
    } else {
      sanitized.sets = params.sets;
    }

    // Reps validation
    if (!Array.isArray(params.reps)) {
      errors.push('Reps must be an array');
    } else {
      const reps = params.reps.filter(r => Number.isInteger(r) && r > 0 && r <= 100);
      if (reps.length !== params.reps.length) {
        errors.push('All reps must be integers between 1 and 100');
      } else if (params.sets && reps.length !== params.sets) {
        errors.push(`Reps array length (${reps.length}) must match sets (${params.sets})`);
      } else {
        sanitized.reps = reps;
      }
    }

    // Weight validation (if provided)
    if (params.weight !== undefined && params.weight !== null) {
      if (!Array.isArray(params.weight)) {
        errors.push('Weight must be an array when provided');
      } else {
        const weights = params.weight.filter(w => 
          typeof w === 'number' && 
          isFinite(w) && 
          w >= 0 && 
          w <= 2000 // Reasonable upper limit
        );
        
        if (weights.length !== params.weight.length) {
          errors.push('All weights must be valid numbers between 0 and 2000');
        } else if (params.sets && weights.length !== params.sets) {
          errors.push(`Weight array length (${weights.length}) must match sets (${params.sets})`);
        } else {
          sanitized.weight = weights;
        }
      }

      // Unit validation when weight is provided
      if (!params.unit || !['kg', 'lbs'].includes(params.unit)) {
        errors.push('Unit must be "kg" or "lbs" when weight is provided');
      } else {
        sanitized.unit = params.unit;
      }
    }

    // Duration validation (optional)
    if (params.duration && typeof params.duration === 'string') {
      if (params.duration.length > 50) {
        errors.push('Duration cannot exceed 50 characters');
      } else {
        sanitized.duration = params.duration.trim();
      }
    }

    // Notes validation (optional)
    if (params.notes && typeof params.notes === 'string') {
      if (params.notes.length > 500) {
        errors.push('Notes cannot exceed 500 characters');
      } else {
        sanitized.notes = params.notes.trim();
      }
    }

    return {
      isValid: errors.length === 0,
      sanitized: errors.length === 0 ? sanitized : undefined,
      errors
    };
  }

  // Rate limiting for rapid-fire requests
  private static userLastRequest = new Map<string, number>();
  private static readonly MIN_REQUEST_INTERVAL = 1000; // 1 second

  static checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const lastRequest = this.userLastRequest.get(userId) || 0;
    
    if (now - lastRequest < this.MIN_REQUEST_INTERVAL) {
      return false; // Rate limited
    }
    
    this.userLastRequest.set(userId, now);
    return true;
  }

  // Validate JSON payload size for action logs
  static validatePayloadSize(payload: any): boolean {
    const jsonString = JSON.stringify(payload);
    const sizeInBytes = new TextEncoder().encode(jsonString).length;
    const maxSize = 64 * 1024; // 64KB limit
    
    return sizeInBytes <= maxSize;
  }

  // Detect and sanitize potentially dangerous content
  static sanitizeContent(content: string): string {
    return content
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '') // Remove emojis
      .trim()
      .substring(0, 1000); // Limit length
  }
}

export { InputValidator };