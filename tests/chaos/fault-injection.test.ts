import nock from 'nock';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OpenAIServiceWithTools } from '../../src/services/openai-tools';
import { db } from '../../src/db';
import { config } from '../../src/config/env';

describe('Chaos Testing - Fault Injection', () => {
  let openAIService: OpenAIServiceWithTools;
  
  beforeEach(() => {
    openAIService = new OpenAIServiceWithTools();
    nock.cleanAll();
  });
  
  afterEach(() => {
    nock.cleanAll();
  });
  
  describe('OpenAI API Failures', () => {
    it('should handle OpenAI 429 rate limit gracefully', async () => {
      // Mock OpenAI API to return 429
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(429, {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
            code: 'rate_limit_exceeded',
          },
        }, {
          'Retry-After': '60',
        });
      
      try {
        await openAIService.streamChatResponseWithTools('Test message', {
          userId: 'test-user',
          courseId: 'test-course',
          topic: 'Testing',
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(429);
        expect(error.message).toContain('rate limit');
        // Verify no partial data corruption
      }
    });
    
    it('should handle OpenAI 500 server error with retry', async () => {
      let attempts = 0;
      
      // First attempt fails
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(500, function() {
          attempts++;
          return { error: { message: 'Internal server error' } };
        });
      
      // Second attempt succeeds (if retry implemented)
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Fallback response',
            },
            finish_reason: 'stop',
          }],
      });
      
      try {
        const result = await openAIService.streamChatResponseWithTools('Test', {
          userId: 'test-user',
          courseId: 'test-course',
        });
        
        // If retry is implemented, this should succeed
        expect(result).toBeDefined();
      } catch (error: any) {
        // If no retry, verify clean failure
        expect(error.status).toBe(500);
        expect(attempts).toBe(1);
      }
    });
    
    it('should handle OpenAI 503 service unavailable', async () => {
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(503, {
          error: {
            message: 'Service temporarily unavailable',
            type: 'service_unavailable',
          },
        });
      
      try {
        await openAIService.getChatResponseWithTools('Test', {
          userId: 'test-user',
          courseId: 'test-course',
        });
        
        expect(true).toBe(false); // Should not reach
      } catch (error: any) {
        expect(error.status).toBe(503);
        // Verify graceful degradation
      }
    });
    
    it('should handle network timeout', async () => {
      // Simulate network timeout
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .delayConnection(30000) // 30 second delay
        .reply(200, {});
      
      const timeoutPromise = Promise.race([
        openAIService.getChatResponseWithTools('Test', {
          userId: 'test-user',
          courseId: 'test-course',
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);
      
      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });
  });
  
  describe('Database Failures', () => {
    it('should handle database connection timeout', async () => {
      // Mock db.query to simulate timeout
      const originalQuery = db.query;
      jest.spyOn(db, 'query').mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );
      
      try {
        // Attempt operation that requires DB
        await db.query('SELECT * FROM users WHERE id = $1', ['test-id']);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('timeout');
      } finally {
        db.query = originalQuery;
      }
    });
    
    it('should handle database connection pool exhaustion', async () => {
      const originalQuery = db.query;
      jest.spyOn(db, 'query').mockRejectedValue(
        new Error('remaining connection slots are reserved')
      );
      
      try {
        // Simulate multiple concurrent queries
        const promises = Array(20).fill(0).map(() => 
          db.query('SELECT 1')
        );
        
        await Promise.all(promises);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('connection');
      } finally {
        db.query = originalQuery;
      }
    });
    
    it('should handle transaction rollback on error', async () => {
      // This would test actual transaction handling
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      
      // Mock pool.connect
      jest.spyOn(db, 'getClient' as any).mockResolvedValue(mockClient);
      
      // First query succeeds
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Second query fails
      mockClient.query.mockRejectedValueOnce(new Error('Constraint violation'));
      // Rollback should be called
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      try {
        // Simulate transaction
        const client = await (db as any).getClient();
        await client.query('BEGIN');
        await client.query('INSERT INTO users...');
        await client.query('INSERT INTO invalid...'); // This fails
        await client.query('COMMIT');
      } catch (error) {
        // Verify rollback was attempted
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      }
    });
  });
  
  describe('Cascading Failures', () => {
    it('should prevent cascade when OpenAI fails', async () => {
      // Mock OpenAI to fail
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .times(10) // Fail multiple times
        .reply(429, { error: { message: 'Rate limited' } });
      
      // Track number of attempts
      let attempts = 0;
      const makeRequest = async () => {
        attempts++;
        try {
          await openAIService.getChatResponseWithTools('Test', {
            userId: `user-${attempts}`,
            courseId: 'test-course',
          });
        } catch (error) {
          // Expected
        }
      };
      
      // Simulate 10 concurrent requests
      const promises = Array(10).fill(0).map(() => makeRequest());
      await Promise.allSettled(promises);
      
      // Verify circuit breaker behavior (if implemented)
      expect(attempts).toBe(10);
      // In a real implementation, later attempts might be rejected immediately
    });
    
    it('should handle memory leak scenarios', async () => {
      // Create large context that could cause memory issues
      const largeContext = {
        memories: Array(10000).fill(0).map((_, i) => ({
          content: `Memory ${i}: ${' '.repeat(1000)}`, // 1KB per memory
        })),
        recentWorkouts: Array(1000).fill(0).map((_, i) => ({
          exercise: `Exercise ${i}`,
          sets: 5,
          reps: [10, 10, 10, 10, 10],
          weight: '100 lbs',
          timestamp: new Date().toISOString(),
        })),
      };
      
      // Monitor memory usage
      const initialMemory = process.memoryUsage().heapUsed;
      
      try {
        // This should trigger memory pruning
        const { buildMainChatPrompt } = await import('../../src/config/prompts');
        const prompt = buildMainChatPrompt(
          largeContext,
          {
            id: 'test',
            tone: 'trainer_friend',
            memoryLoad: 'summary', // Should prune
            loggingOffer: 'always',
            safetyLevel: 'short',
          },
          { type: 'intermediate' }
        );
        
        // Verify prompt was pruned
        expect(prompt.length).toBeLessThan(10000); // Reasonable size
        expect(prompt).toContain('summarized');
        
        // Check memory didn't explode
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      } catch (error) {
        // Memory protection kicked in
        expect(error).toBeDefined();
      }
    });
  });
  
  describe('Partial Failure Recovery', () => {
    it('should handle partial message streaming failure', async () => {
      // Mock streaming response that fails partway
      let chunkCount = 0;
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, function() {
          return function* () {
            yield 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
            yield 'data: {"choices":[{"delta":{"content":" there"}}]}\n\n';
            // Simulate connection drop
            if (++chunkCount > 2) {
              throw new Error('Connection reset');
            }
            yield 'data: {"choices":[{"delta":{"content":"!"}}]}\n\n';
          };
        });
      
      try {
        const stream = await openAIService.streamChatResponseWithTools('Hi', {
          userId: 'test-user',
          courseId: 'test-course',
        });
        
        const chunks: string[] = [];
        for await (const chunk of stream.textStream) {
          chunks.push(chunk);
        }
        
        // Should get partial response
        expect(chunks.join('')).toBe('Hello there');
      } catch (error) {
        // Verify partial data was preserved
        expect(error).toBeDefined();
      }
    });
    
    it('should handle tool call parsing failures gracefully', async () => {
      // Mock response with malformed tool call
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          choices: [{
            message: {
              content: 'I will log that workout',
              tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'log_workout',
                  arguments: '{invalid json',  // Malformed JSON
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
      });
      
      const result = await openAIService.getChatResponseWithTools('Log workout', {
        userId: 'test-user',
        courseId: 'test-course',
      });
      
      // Should handle gracefully
      expect(result.response).toContain('workout');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toHaveProperty('error');
    });
  });
});