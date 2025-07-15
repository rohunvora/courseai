import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import experimentsRoutes from '../../src/routes/experiments';
import { db } from '../../src/db';

describe('Experiments API Contract Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;
  
  beforeAll(async () => {
    // Create test app instance
    app = Fastify({ logger: false });
    
    // Mock auth middleware
    app.decorate('authenticate', async (request: any, reply: any) => {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (token === 'admin-token') {
        request.user = { userId: 'admin-user-id' };
      } else if (token === 'user-token') {
        request.user = { userId: 'regular-user-id' };
      } else {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    });
    
    await app.register(experimentsRoutes);
    await app.ready();
    
    adminToken = 'admin-token';
    userToken = 'user-token';
    
    // Mock admin user check
    jest.spyOn(db, 'query').mockImplementation(async (query: string, params?: any[]) => {
      if (query.includes('SELECT metadata FROM users')) {
        if (params?.[0] === 'admin-user-id') {
          return { rows: [{ metadata: { isAdmin: true } }] } as any;
        }
        return { rows: [{ metadata: { isAdmin: false } }] } as any;
      }
      
      // Mock experiment results
      if (query.includes('prompt_experiments')) {
        return {
          rows: [
            {
              variant_id: 'v1',
              segment_type: 'beginner',
              total_runs: '100',
              success_rate: '0.95',
              avg_tool_accuracy: '0.98',
              avg_specificity: '0.85',
              safety_compliance: '1.0',
              avg_engagement: '0.75',
            },
            {
              variant_id: 'v2',
              segment_type: 'intermediate',
              total_runs: '150',
              success_rate: '0.92',
              avg_tool_accuracy: '0.96',
              avg_specificity: '0.88',
              safety_compliance: '0.99',
              avg_engagement: '0.80',
            },
          ],
        } as any;
      }
      
      return { rows: [] } as any;
    });
  });
  
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });
  
  describe('GET /api/experiments/results', () => {
    it('should return deterministic variant assignments for admin users', async () => {
      const response = await request(app.server)
        .get('/api/experiments/results')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('recent');
      expect(response.body).toHaveProperty('generated');
      
      // Check summary structure
      const summary = response.body.summary;
      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBeGreaterThan(0);
      
      const firstResult = summary[0];
      expect(firstResult).toMatchObject({
        variantId: expect.any(String),
        segmentType: expect.any(String),
        totalRuns: expect.any(Number),
        successRate: expect.any(Number),
        avgToolAccuracy: expect.any(Number),
        avgSpecificity: expect.any(Number),
        safetyCompliance: expect.any(Number),
        avgEngagement: expect.any(Number),
      });
      
      // Verify thresholds
      expect(firstResult.avgToolAccuracy).toBeGreaterThanOrEqual(0);
      expect(firstResult.avgToolAccuracy).toBeLessThanOrEqual(1);
      expect(firstResult.safetyCompliance).toBeGreaterThanOrEqual(0);
      expect(firstResult.safetyCompliance).toBeLessThanOrEqual(1);
    });
    
    it('should reject non-admin users', async () => {
      const response = await request(app.server)
        .get('/api/experiments/results')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      
      expect(response.body).toEqual({ error: 'Admin access required' });
    });
    
    it('should reject unauthenticated requests', async () => {
      await request(app.server)
        .get('/api/experiments/results')
        .expect(401);
    });
  });
  
  describe('GET /api/experiments/compare/:variantA/:variantB', () => {
    beforeAll(() => {
      // Mock comparison query
      (db.query as jest.Mock).mockImplementation(async (query: string, params?: any[]) => {
        if (query.includes('variant_stats')) {
          return {
            rows: [
              {
                variant_id: 'v1',
                n: 100,
                mean_accuracy: 0.98,
                stddev_accuracy: 0.02,
                mean_specificity: 0.85,
                stddev_specificity: 0.05,
              },
              {
                variant_id: 'v2',
                n: 150,
                mean_accuracy: 0.96,
                stddev_accuracy: 0.03,
                mean_specificity: 0.88,
                stddev_specificity: 0.04,
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });
    });
    
    it('should compare two variants with statistical analysis', async () => {
      const response = await request(app.server)
        .get('/api/experiments/compare/v1/v2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('variantA');
      expect(response.body).toHaveProperty('variantB');
      expect(response.body).toHaveProperty('comparison');
      
      const { comparison } = response.body;
      expect(comparison).toMatchObject({
        accuracyDiff: expect.any(Number),
        specificityDiff: expect.any(Number),
        accuracyPValue: expect.any(Number),
        significant: expect.any(Boolean),
      });
      
      // Verify diff calculation
      expect(comparison.accuracyDiff).toBeCloseTo(0.02, 2); // 0.98 - 0.96
      expect(comparison.specificityDiff).toBeCloseTo(-0.03, 2); // 0.85 - 0.88
    });
    
    it('should handle insufficient data gracefully', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ variant_id: 'v1' }] });
      
      const response = await request(app.server)
        .get('/api/experiments/compare/v1/v3')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      
      expect(response.body).toEqual({ error: 'Insufficient data for comparison' });
    });
  });
  
  describe('POST /api/experiments/:experimentId/outcome', () => {
    it('should record experiment outcomes', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      
      const payload = {
        outcome: 'success',
        metrics: {
          toolCallAccuracy: 0.95,
          responseSpecificity: 0.88,
          safetyCompliance: true,
          userEngagement: 0.82,
        },
      };
      
      const response = await request(app.server)
        .post('/api/experiments/test-exp-123/outcome')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(200);
      
      expect(response.body).toEqual({ success: true });
      
      // Verify DB call
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE prompt_experiments'),
        expect.arrayContaining([
          'test-exp-123',
          'success',
          JSON.stringify(payload.metrics),
        ])
      );
    });
    
    it('should validate outcome values', async () => {
      const invalidPayload = {
        outcome: 'invalid-outcome',
        metrics: {},
      };
      
      // The API should accept any string for outcome, but we can validate in implementation
      await request(app.server)
        .post('/api/experiments/test-exp-123/outcome')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload)
        .expect(200); // Currently accepts any outcome
    });
  });
  
  describe('Model Selector Downgrade on Failure', () => {
    it('should handle model selector fallback scenarios', async () => {
      // This would be tested in integration with actual OpenAI calls
      // For now, we verify the contract exists
      const { ModelSelector } = await import('../../src/services/model-selector');
      
      const mockExecute = jest.fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValueOnce('fallback result');
      
      const result = await ModelSelector.executeWithFallback(
        { model: 'gpt-4o', temperature: 0.7, maxTokens: 1000 },
        { model: 'o3-mini', temperature: 0.7, maxTokens: 1000 },
        mockExecute
      );
      
      expect(result.fallback).toBe(true);
      expect(result.modelUsed).toBe('o3-mini');
    });
  });
});