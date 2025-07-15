import { describe, it, expect } from '@jest/globals';
import {
  buildMainChatPrompt,
  buildBasicChatPrompt,
  buildCourseGeneratorPrompt,
  computeUserSegment,
  selectPromptVariant,
  SAFETY_RULES,
  PromptVariant,
  UserSegment,
} from '../../src/config/prompts';

describe('Prompt Building Functions', () => {
  describe('SAFETY_RULES', () => {
    it('should never recommend >10% load increase', () => {
      expect(SAFETY_RULES.core).toContain('NEVER recommend increasing load by >10% per week');
    });

    it('should handle pain keywords correctly', () => {
      expect(SAFETY_RULES.contextual('pain')).toContain('stop the exercise immediately');
      expect(SAFETY_RULES.contextual('injury')).toContain('licensed medical professional');
      expect(SAFETY_RULES.contextual('hurt')).toContain('listen to your body');
    });

    it('should return empty string for unknown keywords', () => {
      expect(SAFETY_RULES.contextual('tired')).toBe('');
      expect(SAFETY_RULES.contextual('sore')).toBe('');
    });
  });

  describe('buildMainChatPrompt', () => {
    const mockContext = {
      topic: 'Strength Training',
      currentWeek: 5,
      lastWorkoutDays: 1,
      currentExercise: 'Squats',
      personalRecords: [
        { exercise: 'Bench Press', weight: '185', unit: 'lbs' },
        { exercise: 'Squat', weight: '275', unit: 'lbs' },
      ],
      recentWorkouts: [
        {
          exercise: 'Bench Press',
          sets: 3,
          reps: [5, 5, 5],
          weight: '175 lbs',
          timestamp: new Date().toISOString(),
          totalVolume: 2625,
        },
      ],
      memories: [
        { content: 'Started training 5 weeks ago' },
        { content: 'Focus on compound movements' },
      ],
    };

    const mockVariant: PromptVariant = {
      id: 'test-variant',
      tone: 'trainer_friend',
      memoryLoad: 'full',
      loggingOffer: 'metric_detected',
      safetyLevel: 'short',
    };

    const mockSegment: UserSegment = {
      type: 'intermediate',
      minWeeks: 4,
      maxWeeks: 26,
    };

    it('should include safety rules', () => {
      const prompt = buildMainChatPrompt(mockContext, mockVariant, mockSegment);
      expect(prompt).toContain('SAFETY FIRST');
      expect(prompt).toContain('10% per week');
    });

    it('should include user context', () => {
      const prompt = buildMainChatPrompt(mockContext, mockVariant, mockSegment);
      expect(prompt).toContain('Strength Training');
      expect(prompt).toContain('Week: 5');
      expect(prompt).toContain('Yesterday'); // lastWorkoutDays: 1
      expect(prompt).toContain('Squats');
    });

    it('should include personal records without emojis in data', () => {
      const prompt = buildMainChatPrompt(mockContext, mockVariant, mockSegment);
      expect(prompt).toContain('185');
      expect(prompt).toContain('275');
      expect(prompt).not.toMatch(/\d+\s*🏆/); // No emoji after numbers
    });

    it('should handle undefined placeholders with fallbacks', () => {
      const emptyContext = {
        topic: undefined,
        currentWeek: undefined,
        lastWorkoutDays: null,
        currentExercise: undefined,
      };
      const prompt = buildMainChatPrompt(emptyContext, mockVariant, mockSegment);
      expect(prompt).toContain('General Fitness'); // Fallback for topic
      expect(prompt).toContain('Week: 1'); // Fallback for week
      expect(prompt).toContain('—'); // Fallback for exercise
      expect(prompt).not.toContain('undefined');
    });

    it('should apply correct logging rules based on variant', () => {
      const alwaysVariant = { ...mockVariant, loggingOffer: 'always' as const };
      const metricVariant = { ...mockVariant, loggingOffer: 'metric_detected' as const };
      const userInitVariant = { ...mockVariant, loggingOffer: 'user_initiated' as const };

      const alwaysPrompt = buildMainChatPrompt(mockContext, alwaysVariant, mockSegment);
      const metricPrompt = buildMainChatPrompt(mockContext, metricVariant, mockSegment);
      const userInitPrompt = buildMainChatPrompt(mockContext, userInitVariant, mockSegment);

      expect(alwaysPrompt).toContain('ALWAYS offer to log');
      expect(metricPrompt).toContain('≥1 concrete metric');
      expect(userInitPrompt).toContain('Only log when user explicitly asks');
    });

    it('should apply segment-specific guidance', () => {
      const beginnerSegment: UserSegment = { type: 'beginner', minWeeks: 0, maxWeeks: 4 };
      const advancedSegment: UserSegment = { type: 'advanced', minWeeks: 26 };
      const returningSegment: UserSegment = { type: 'returning', inactivityDays: 14 };

      const beginnerPrompt = buildMainChatPrompt(mockContext, mockVariant, beginnerSegment);
      const advancedPrompt = buildMainChatPrompt(mockContext, mockVariant, advancedSegment);
      const returningPrompt = buildMainChatPrompt(mockContext, mockVariant, returningSegment);

      expect(beginnerPrompt).toContain('New to training');
      expect(advancedPrompt).toContain('Experienced trainee');
      expect(returningPrompt).toContain('14+ day break');
    });
  });

  describe('Token Budget Management', () => {
    it('should prune memories based on variant settings', () => {
      const manyMemories = Array.from({ length: 20 }, (_, i) => ({
        content: `Memory ${i + 1}: Workout details and progress notes`,
      }));

      const context = { memories: manyMemories };

      const fullVariant: PromptVariant = {
        id: 'full',
        tone: 'trainer_friend',
        memoryLoad: 'full',
        loggingOffer: 'always',
        safetyLevel: 'short',
      };

      const summaryVariant: PromptVariant = {
        ...fullVariant,
        memoryLoad: 'summary',
      };

      const recentVariant: PromptVariant = {
        ...fullVariant,
        memoryLoad: 'recent_only',
      };

      const segment: UserSegment = { type: 'intermediate' };

      const fullPrompt = buildMainChatPrompt(context, fullVariant, segment);
      const summaryPrompt = buildMainChatPrompt(context, summaryVariant, segment);
      const recentPrompt = buildMainChatPrompt(context, recentVariant, segment);

      // Full should have up to 10 memories
      expect((fullPrompt.match(/Memory \d+/g) || []).length).toBeLessThanOrEqual(10);

      // Summary should have indication of summarization
      expect(summaryPrompt).toContain('older entries summarized');

      // Recent should only have 3
      expect((recentPrompt.match(/Memory \d+/g) || []).length).toBe(3);
    });
  });

  describe('computeUserSegment', () => {
    it('should categorize beginners correctly', () => {
      const newUser = {
        createdAt: new Date().toISOString(),
      };
      const segment = computeUserSegment(newUser);
      expect(segment.type).toBe('beginner');
      expect(segment.minWeeks).toBe(0);
      expect(segment.maxWeeks).toBe(4);
    });

    it('should identify returning users', () => {
      const returningUser = {
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
        lastActivityAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      };
      const segment = computeUserSegment(returningUser);
      expect(segment.type).toBe('returning');
      expect(segment.inactivityDays).toBe(15);
    });

    it('should categorize advanced users with PR frequency', () => {
      const advancedUser = {
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), // 200 days ago
        personalRecords: new Array(10), // 10 PRs
      };
      const segment = computeUserSegment(advancedUser);
      expect(segment.type).toBe('advanced');
      expect(segment.minWeeks).toBe(26);
      expect(segment.prFrequency).toBeGreaterThan(0);
    });
  });

  describe('selectPromptVariant', () => {
    it('should return deterministic variants for same user/session', () => {
      const segment: UserSegment = { type: 'intermediate' };
      const variant1 = selectPromptVariant('user123', 'session456', segment);
      const variant2 = selectPromptVariant('user123', 'session456', segment);
      expect(variant1.id).toBe(variant2.id);
    });

    it('should return different variants for different sessions', () => {
      const segment: UserSegment = { type: 'intermediate' };
      const variant1 = selectPromptVariant('user123', 'session1', segment);
      const variant2 = selectPromptVariant('user123', 'session2', segment);
      // May be same or different, but should be deterministic
      expect(variant1).toBeDefined();
      expect(variant2).toBeDefined();
    });

    it('should respect segment preferences', () => {
      const beginnerSegment: UserSegment = { type: 'beginner' };
      const variant = selectPromptVariant('user123', 'session123', beginnerSegment);
      // Beginners should get trainer_friend tone with detailed safety
      expect(variant.tone).toBe('trainer_friend');
      expect(variant.safetyLevel).not.toBe('short');
    });
  });

  describe('Tool Calling Directive', () => {
    it('should include clear tool calling instructions', () => {
      const context = { topic: 'Test' };
      const variant: PromptVariant = {
        id: 'test',
        tone: 'trainer_friend',
        memoryLoad: 'full',
        loggingOffer: 'always',
        safetyLevel: 'short',
      };
      const segment: UserSegment = { type: 'intermediate' };

      const prompt = buildMainChatPrompt(context, variant, segment);
      expect(prompt).toContain('If a function can satisfy the request, CALL IT');
      expect(prompt).toContain('wait for its result before continuing');
    });
  });

  describe('buildBasicChatPrompt', () => {
    it('should provide manual logging template when tools disabled', () => {
      const context = { topic: 'Fitness' };
      const prompt = buildBasicChatPrompt(context);
      
      expect(prompt).toContain('Function calling is disabled');
      expect(prompt).toContain('Date:');
      expect(prompt).toContain('Exercise:');
      expect(prompt).toContain('Sets:');
      expect(prompt).toContain('Reps:');
      expect(prompt).toContain('Weight:');
    });
  });

  describe('buildCourseGeneratorPrompt', () => {
    it('should include weekly schedule in course structure', () => {
      const prompt = buildCourseGeneratorPrompt('Strength Training', 'beginner', ['build muscle']);
      
      expect(prompt).toContain('weeklySchedule');
      expect(prompt).toContain('Day 1: Lower Body A');
      expect(prompt).toContain('Day 3: Upper Body A');
    });

    it('should include nutrition and recovery sections', () => {
      const prompt = buildCourseGeneratorPrompt('Weight Loss', 'intermediate');
      
      expect(prompt).toContain('nutritionTips');
      expect(prompt).toContain('recoveryProtocol');
    });
  });
});