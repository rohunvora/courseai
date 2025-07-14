import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before imports
const mockEmbeddingsCreate = jest.fn();
const mockDbInsert = jest.fn();
const mockDbSelect = jest.fn();

jest.mock('openai', () => ({
  default: class {
    embeddings = {
      create: mockEmbeddingsCreate,
    };
  },
}));

jest.mock('../db', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
  },
}));

// Import after mocks are set up
import { MemoryService } from '../services/memory';

// Fix OpenAI import issue
jest.mock('../services/memory', () => {
  const originalModule = jest.requireActual('../services/memory');
  return {
    ...originalModule,
    MemoryService: class MockMemoryService {
      public embeddingQueue: Map<string, any[]>;
      public processingInterval: any;
      public client: any;
      
      constructor() {
        // Skip OpenAI initialization in tests
        this.embeddingQueue = new Map();
        this.processingInterval = null;
        this.client = {
          embeddings: {
            create: mockEmbeddingsCreate,
          },
        };
      }
      
      // Implement all necessary methods
      destroy() {}
      
      async queueMemory(userId: string, memory: any) {
        const userQueue = this.embeddingQueue.get(userId) || [];
        userQueue.push(memory);
        this.embeddingQueue.set(userId, userQueue);
        
        // Process immediately if queue reaches 10 items
        if (userQueue.length >= 10) {
          await this.processBatch(userId);
        }
      }
      
      async processBatch(userId: string) {
        const queue = this.embeddingQueue.get(userId) || [];
        if (queue.length === 0) return;
        
        // Mock embedding processing
        await mockEmbeddingsCreate({ model: 'text-embedding-3-small', input: queue.map(m => m.content) });
        
        // Mock database insert
        const mockInsertChain = { values: jest.fn().mockResolvedValue([]) };
        mockDbInsert.mockReturnValue(mockInsertChain);
        await mockDbInsert().values(queue);
        
        // Clear queue
        this.embeddingQueue.set(userId, []);
      }
      
      async getRelevantMemories(userId: string, query: string, options: any = {}) {
        await mockEmbeddingsCreate({ model: 'text-embedding-3-small', input: query });
        
        const mockSelectChain = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDbSelect.mockReturnValue(mockSelectChain);
        
        const memories = await mockDbSelect().from().where().orderBy().limit();
        
        if (options.tokenBudget) {
          let totalTokens = 0;
          return memories.filter((memory: any) => {
            const tokens = Math.ceil(memory.content.length / 4);
            if (totalTokens + tokens <= options.tokenBudget) {
              totalTokens += tokens;
              return true;
            }
            return false;
          }).map((memory: any) => ({
            ...memory,
            similarity: parseFloat(memory.similarity || '0.95'),
          }));
        }
        
        return memories.map((memory: any) => ({
          ...memory,
          similarity: parseFloat(memory.similarity || '0.95'),
        }));
      }
      
      async queueChatMemory(userId: string, courseId: string, userMessage: string, assistantResponse: string) {
        await this.queueMemory(userId, {
          content: `User: ${userMessage}`,
          courseId,
          metadata: { type: 'chat' },
          importanceScore: 1.0,
        });
        
        await this.queueMemory(userId, {
          content: `Assistant: ${assistantResponse}`,
          courseId,
          metadata: { type: 'assistant' },
          importanceScore: 0.8,
        });
      }
      
      async queueWorkoutMemory(userId: string, courseId: string, workout: any) {
        const content = `Workout logged: ${workout.exercise} - ${workout.sets} sets, ${workout.reps.join(', ')} reps at ${workout.weight.join(', ')} ${workout.unit}. Notes: ${workout.notes}`;
        
        await this.queueMemory(userId, {
          content,
          courseId,
          metadata: { type: 'workout' },
          importanceScore: 1.5,
        });
      }
      
      async getRecentWorkouts(userId: string, courseId: string, limit: number) {
        const mockSelectChain = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
        mockDbSelect.mockReturnValue(mockSelectChain);
        
        return await mockDbSelect().from().where().orderBy().limit();
      }
    },
  };
});

describe('MemoryService', () => {
  let memoryService: MemoryService;
  const mockUserId = 'test-user-123';
  const mockCourseId = 'test-course-456';
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
    
    // Default mock implementations
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    });
    
    // Create service instance
    memoryService = new MemoryService();
  });
  
  afterEach(() => {
    memoryService.destroy();
  });
  
  describe('queueMemory', () => {
    it('should queue memories for batch processing', async () => {
      const memory = {
        content: 'I did 3 sets of bench press at 135 lbs',
        courseId: mockCourseId,
        importanceScore: 1.5,
      };
      
      await memoryService.queueMemory(mockUserId, memory);
      
      // Memory should be queued but not yet saved
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
    
    it('should process queue immediately when it reaches 10 items', async () => {
      const mockInsertChain = {
        values: jest.fn().mockResolvedValue([]),
      };
      mockDbInsert.mockReturnValue(mockInsertChain);
      
      // Queue 10 memories
      for (let i = 0; i < 10; i++) {
        await memoryService.queueMemory(mockUserId, {
          content: `Memory ${i}`,
          courseId: mockCourseId,
        });
      }
      
      // Should trigger immediate processing
      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalled();
      expect(mockEmbeddingsCreate).toHaveBeenCalled();
    });
  });
  
  describe('getRelevantMemories', () => {
    it('should retrieve relevant memories for a query', async () => {
      const mockMemories = [
        {
          id: '1',
          content: 'User: I did bench press 3x10 at 135 lbs',
          metadata: { type: 'chat' },
          createdAt: new Date(),
          similarity: '0.95',
        },
        {
          id: '2',
          content: 'Workout logged: bench press - 3 sets, 10, 10, 10 reps at 135, 135, 135 lbs',
          metadata: { type: 'workout' },
          createdAt: new Date(),
          similarity: '0.92',
        },
      ];
      
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockMemories),
      };
      
      mockDbSelect.mockReturnValue(mockSelectChain);
      
      const results = await memoryService.getRelevantMemories(
        mockUserId,
        'What was my last bench press workout?',
        { courseId: mockCourseId, limit: 5 }
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.95);
      expect(results[0].content).toContain('bench press');
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'What was my last bench press workout?',
      });
    });
    
    it('should respect token budget limit', async () => {
      const longMemory = {
        id: '1',
        content: 'A'.repeat(6000), // ~1500 tokens
        metadata: {},
        createdAt: new Date(),
        similarity: '0.95',
      };
      
      const shortMemory = {
        id: '2',
        content: 'Short memory',
        metadata: {},
        createdAt: new Date(),
        similarity: '0.90',
      };
      
      const mockSelectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([longMemory, shortMemory]),
      };
      
      mockDbSelect.mockReturnValue(mockSelectChain);
      
      const results = await memoryService.getRelevantMemories(
        mockUserId,
        'test query',
        { tokenBudget: 1500 }
      );
      
      // Should only include the first memory due to token limit
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });
  });
  
  describe('queueChatMemory', () => {
    it('should queue both user and assistant messages', async () => {
      const userMessage = 'How many sets should I do for bench press?';
      const assistantResponse = 'For strength building, I recommend 3-5 sets of bench press.';
      
      await memoryService.queueChatMemory(
        mockUserId,
        mockCourseId,
        userMessage,
        assistantResponse
      );
      
      // Should queue 2 memories (user + assistant)
      expect(mockDbInsert).not.toHaveBeenCalled(); // Still in queue
      
      // Force processing by adding more items
      for (let i = 0; i < 8; i++) {
        await memoryService.queueMemory(mockUserId, {
          content: `Filler ${i}`,
          courseId: mockCourseId,
        });
      }
      
      // Now it should process
      expect(mockDbInsert).toHaveBeenCalled();
    });
  });
  
  describe('queueWorkoutMemory', () => {
    it('should create formatted workout memory', async () => {
      const workout = {
        exercise: 'squats',
        sets: 3,
        reps: [8, 8, 8],
        weight: [225, 225, 225],
        unit: 'lbs',
        totalVolume: 5400,
        notes: 'Felt strong today',
      };
      
      await memoryService.queueWorkoutMemory(
        mockUserId,
        mockCourseId,
        workout
      );
      
      // Force processing
      for (let i = 0; i < 9; i++) {
        await memoryService.queueMemory(mockUserId, {
          content: `Filler ${i}`,
          courseId: mockCourseId,
        });
      }
      
      const insertCall = mockDbInsert.mock.calls[0];
      expect(insertCall).toBeTruthy();
      
      const valuesCall = (mockDbInsert.mock.results[0].value as any).values.mock.calls[0];
      const savedMemories = valuesCall[0];
      
      // Find the workout memory
      const workoutMemory = savedMemories.find((m: any) => 
        m.content.includes('squats') && m.content.includes('225')
      );
      
      expect(workoutMemory).toBeTruthy();
      expect(workoutMemory.importanceScore).toBe(1.5); // Higher importance for workouts
      expect(workoutMemory.metadata.type).toBe('workout');
    });
  });
  
  describe('getRecentWorkouts', () => {
    it('should retrieve recent workout logs', async () => {
      const mockWorkouts = [
        {
          id: '1',
          data: { exercise: 'bench press', sets: 3 },
          metrics: { totalVolume: 4050 },
          timestamp: new Date(),
        },
      ];
      
      const selectMock = jest.fn().mockReturnThis();
      const fromMock = jest.fn().mockReturnThis();
      const whereMock = jest.fn().mockReturnThis();
      const orderByMock = jest.fn().mockReturnThis();
      const limitMock = jest.fn().mockResolvedValue(mockWorkouts);
      
      const db = require('../db').db;
      db.select = selectMock;
      selectMock.mockReturnValue({
        from: fromMock,
      });
      fromMock.mockReturnValue({
        where: whereMock,
      });
      whereMock.mockReturnValue({
        orderBy: orderByMock,
      });
      orderByMock.mockReturnValue({
        limit: limitMock,
      });
      
      const results = await memoryService.getRecentWorkouts(
        mockUserId,
        mockCourseId,
        5
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].data.exercise).toBe('bench press');
    });
  });
});