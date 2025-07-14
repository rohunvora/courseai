import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  executeUpdateProgress, 
  executeGetProgressSummary, 
  executeUpdateCourseGoal,
  executeTool 
} from '../services/tools';

// Mock database
const mockInsert = jest.fn() as any;
const mockUpdate = jest.fn() as any;
const mockSelect = jest.fn() as any;

jest.mock('../db', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    select: (...args: any[]) => mockSelect(...args),
  },
}));

describe('Tool Functions', () => {
  const mockContext = {
    userId: 'user-123',
    courseId: 'course-456',
    sessionId: 'session-789',
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockInsert.mockReturnValue({
      values: (jest.fn() as any).mockResolvedValue([]),
    });
  });
  
  describe('executeUpdateProgress', () => {
    it('should update an existing progress log', async () => {
      const existingLog = {
        id: 'log-123',
        userId: 'user-123',
        data: {
          exercise: 'bench press',
          sets: 3,
          reps: [10, 8, 6],
          weight: [135, 135, 135],
          unit: 'lbs',
        },
        metrics: {
          totalVolume: 3510,
          totalReps: 24,
          maxWeight: 135,
        },
        notes: 'Good form',
      };
      
      // Mock finding existing log
      mockSelect.mockReturnValue({
        from: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
        limit: (jest.fn() as any).mockResolvedValue([existingLog]),
      });
      
      // Mock update
      const updatedLog = { ...existingLog, data: { ...existingLog.data, weight: [145, 145, 145] } };
      mockUpdate.mockReturnValue({
        set: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
        returning: (jest.fn() as any).mockResolvedValue([updatedLog]),
      });
      
      const result = await executeUpdateProgress(
        {
          logId: 'log-123',
          updates: { weight: [145, 145, 145] },
        },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.updated).toBeDefined();
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should fail if log not found', async () => {
      mockSelect.mockReturnValue({
        from: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
        limit: (jest.fn() as any).mockResolvedValue([]),
      });
      
      const result = await executeUpdateProgress(
        {
          logId: 'nonexistent',
          updates: { weight: [145] },
        },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('executeGetProgressSummary', () => {
    const mockLogs = [
      {
        data: { exercise: 'bench press', sets: 3, reps: [10, 10, 10] },
        metrics: { totalVolume: 4050, totalReps: 30, maxWeight: 135 },
        timestamp: new Date(),
      },
      {
        data: { exercise: 'squats', sets: 3, reps: [8, 8, 8] },
        metrics: { totalVolume: 5400, totalReps: 24, maxWeight: 225 },
        timestamp: new Date(),
      },
    ];
    
    beforeEach(() => {
      mockSelect.mockReturnValue({
        from: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
      });
    });
    
    it('should get exercise summary', async () => {
      (mockSelect() as any).where.mockResolvedValue(mockLogs);
      
      const result = await executeGetProgressSummary(
        {
          metric: 'exercise',
          exercise: 'bench press',
          timeframe: 'week',
        },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalSessions).toBe(1);
      expect(result.summary.totalVolume).toBe(4050);
    });
    
    it('should get volume summary', async () => {
      (mockSelect() as any).where.mockResolvedValue(mockLogs);
      
      const result = await executeGetProgressSummary(
        {
          metric: 'volume',
          timeframe: 'month',
        },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalVolume).toBe(9450); // 4050 + 5400
      expect(result.summary.byExercise['bench press']).toBe(4050);
      expect(result.summary.byExercise['squats']).toBe(5400);
    });
    
    it('should get frequency summary', async () => {
      (mockSelect() as any).where.mockResolvedValue(mockLogs);
      
      const result = await executeGetProgressSummary(
        {
          metric: 'frequency',
          timeframe: 'week',
        },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.summary.totalWorkouts).toBe(2);
      expect(result.summary.daysActive).toBeGreaterThan(0);
    });
    
    it('should get personal records', async () => {
      (mockSelect() as any).where.mockResolvedValue(mockLogs);
      
      const result = await executeGetProgressSummary(
        {
          metric: 'personal_records',
          timeframe: 'all_time',
        },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.summary.records['bench press']).toBe(135);
      expect(result.summary.records['squats']).toBe(225);
    });
  });
  
  describe('executeUpdateCourseGoal', () => {
    it('should update course goals', async () => {
      const existingCourse = {
        id: 'course-456',
        userId: 'user-123',
        title: 'Strength Training',
        targetLevel: 'intermediate',
        timelineWeeks: 12,
        preferences: { focusAreas: ['strength'] },
      };
      
      mockSelect.mockReturnValue({
        from: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
        limit: (jest.fn() as any).mockResolvedValue([existingCourse]),
      });
      
      const updatedCourse = { 
        ...existingCourse, 
        targetLevel: 'advanced',
        preferences: { focusAreas: ['strength', 'endurance'] },
      };
      
      mockUpdate.mockReturnValue({
        set: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
        returning: (jest.fn() as any).mockResolvedValue([updatedCourse]),
      });
      
      const result = await executeUpdateCourseGoal(
        {
          courseId: 'course-456',
          updates: {
            targetLevel: 'advanced',
            preferences: { focusAreas: ['strength', 'endurance'] },
          },
        },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.updated).toBeDefined();
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should fail if course not found', async () => {
      mockSelect.mockReturnValue({
        from: (jest.fn() as any).mockReturnThis(),
        where: (jest.fn() as any).mockReturnThis(),
        limit: (jest.fn() as any).mockResolvedValue([]),
      });
      
      const result = await executeUpdateCourseGoal(
        {
          courseId: 'nonexistent',
          updates: { title: 'New Title' },
        },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('executeTool', () => {
    it('should route to correct tool function', async () => {
      // Mock log_workout response
      mockInsert.mockReturnValue({
        values: (jest.fn() as any).mockReturnThis(),
        returning: (jest.fn() as any).mockResolvedValue([{ id: 'new-log' }]),
      });
      
      const result = await executeTool(
        'log_workout',
        { exercise: 'deadlift', sets: 1, reps: [5] },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.id).toBe('new-log');
    });
    
    it('should throw error for unknown tool', async () => {
      await expect(
        executeTool('unknown_tool', {}, mockContext)
      ).rejects.toThrow('Unknown tool: unknown_tool');
    });
  });
});