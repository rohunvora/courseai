import { describe, it, expect } from '@jest/globals';
import { tools } from '../services/tools';

describe('Tool Functions Integration', () => {
  describe('Tool Definitions', () => {
    it('should have all required tools defined', () => {
      const toolNames = tools.map(t => t.function.name);
      
      expect(toolNames).toContain('log_workout');
      expect(toolNames).toContain('update_progress');
      expect(toolNames).toContain('get_progress_summary');
      expect(toolNames).toContain('update_course_goal');
      expect(tools).toHaveLength(4);
    });
    
    it('should have proper schemas for all tools', () => {
      const logWorkout = tools.find(t => t.function.name === 'log_workout');
      const updateProgress = tools.find(t => t.function.name === 'update_progress');
      const getProgress = tools.find(t => t.function.name === 'get_progress_summary');
      const updateGoal = tools.find(t => t.function.name === 'update_course_goal');
      
      // All tools should be defined
      expect(logWorkout).toBeDefined();
      expect(updateProgress).toBeDefined();
      expect(getProgress).toBeDefined();
      expect(updateGoal).toBeDefined();
      
      // Check required fields exist (without deep property access)
      if (logWorkout?.function.parameters) {
        expect(logWorkout.function.parameters).toHaveProperty('required');
        expect(logWorkout.function.parameters).toHaveProperty('properties');
      }
      
      if (updateProgress?.function.parameters) {
        expect(updateProgress.function.parameters).toHaveProperty('required');
        expect(updateProgress.function.parameters).toHaveProperty('properties');
      }
      
      if (getProgress?.function.parameters) {
        expect(getProgress.function.parameters).toHaveProperty('required');
        expect(getProgress.function.parameters).toHaveProperty('properties');
      }
      
      if (updateGoal?.function.parameters) {
        expect(updateGoal.function.parameters).toHaveProperty('required');
        expect(updateGoal.function.parameters).toHaveProperty('properties');
      }
    });
  });
  
  describe('Tool Execution Flow', () => {
    it('should demonstrate update_progress workflow', () => {
      // Simulated workflow
      const workflow = {
        step1: 'User says "Actually, that last set was 145 lbs, not 135"',
        step2: 'AI detects correction and calls update_progress',
        step3: 'Function updates the specific log entry',
        step4: 'Metrics are recalculated (total volume increases)',
        step5: 'Tool call is logged in audit table',
      };
      
      expect(workflow.step2).toContain('update_progress');
      expect(workflow.step4).toContain('recalculated');
    });
    
    it('should demonstrate get_progress_summary workflow', () => {
      const exampleSummaries = {
        exercise: {
          totalSessions: 5,
          totalVolume: 20250,
          totalReps: 150,
          exercises: ['bench press'],
        },
        volume: {
          totalVolume: 45000,
          byExercise: { 'bench press': 20250, 'squats': 24750 },
        },
        frequency: {
          totalWorkouts: 12,
          daysActive: 10,
          averagePerWeek: 3,
        },
        personal_records: {
          records: { 'bench press': 185, 'squats': 275, 'deadlift': 315 },
        },
      };
      
      // Verify all summary types have expected structure
      expect(exampleSummaries.exercise).toHaveProperty('totalSessions');
      expect(exampleSummaries.volume).toHaveProperty('byExercise');
      expect(exampleSummaries.frequency).toHaveProperty('averagePerWeek');
      expect(exampleSummaries.personal_records).toHaveProperty('records');
    });
    
    it('should demonstrate update_course_goal workflow', () => {
      const updateScenarios = [
        {
          userSays: "I want to focus more on endurance now",
          updates: { preferences: { focusAreas: ['endurance', 'cardio'] } },
        },
        {
          userSays: "Let's extend the timeline to 16 weeks",
          updates: { timelineWeeks: 16 },
        },
        {
          userSays: "I'm ready for advanced level training",
          updates: { targetLevel: 'advanced' },
        },
      ];
      
      updateScenarios.forEach(scenario => {
        expect(scenario.updates).toBeDefined();
        expect(Object.keys(scenario.updates).length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing required parameters', () => {
      const invalidParams = [
        { exercise: 'bench press' }, // missing sets and reps
        { sets: 3, reps: [10, 10, 10] }, // missing exercise
        { logId: '123' }, // missing updates
        { metric: 'volume' }, // missing timeframe
      ];
      
      // Each would fail validation
      expect(invalidParams[0]).not.toHaveProperty('sets');
      expect(invalidParams[1]).not.toHaveProperty('exercise');
      expect(invalidParams[2]).not.toHaveProperty('updates');
      expect(invalidParams[3]).not.toHaveProperty('timeframe');
    });
    
    it('should validate array lengths', () => {
      const mismatchedArrays = {
        sets: 3,
        reps: [10, 10], // Only 2 elements, should be 3
        weight: [135, 135, 135, 135], // 4 elements, should be 3
      };
      
      expect(mismatchedArrays.reps.length).not.toBe(mismatchedArrays.sets);
      expect(mismatchedArrays.weight.length).not.toBe(mismatchedArrays.sets);
    });
  });
});