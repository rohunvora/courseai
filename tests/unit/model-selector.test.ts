import { describe, it, expect, jest } from '@jest/globals';
import {
  ModelSelector,
  ModelSelectionCriteria,
  getModelForChat,
  getModelForSummarization,
} from '../../src/services/model-selector';

describe('ModelSelector', () => {
  describe('selectModel', () => {
    it('should select GPT-4o for real-time tool usage', () => {
      const criteria: ModelSelectionCriteria = {
        taskType: 'chat',
        estimatedTokens: 1000,
        requiresTools: true,
        isRealtime: true,
        complexity: 'medium',
      };
      
      const config = ModelSelector.selectModel(criteria);
      expect(config.model).toBe('gpt-4o');
      expect(config.reasoning).toContain('Real-time tool usage');
    });

    it('should select O3 for large summarization tasks', () => {
      const criteria: ModelSelectionCriteria = {
        taskType: 'summarization',
        estimatedTokens: 15000,
        requiresTools: false,
        isRealtime: false,
        complexity: 'medium',
      };
      
      const config = ModelSelector.selectModel(criteria);
      expect(config.model).toBe('o3-mini');
      expect(config.reasoning).toContain('Large summarization');
    });

    it('should select O3 for background processing', () => {
      const criteria: ModelSelectionCriteria = {
        taskType: 'extraction',
        estimatedTokens: 5000,
        requiresTools: false,
        isRealtime: false,
        complexity: 'low',
      };
      
      const config = ModelSelector.selectModel(criteria);
      expect(config.model).toBe('o3-mini');
      expect(config.reasoning).toContain('Background processing');
    });

    it('should handle token limit edge cases', () => {
      const criteria: ModelSelectionCriteria = {
        taskType: 'chat',
        estimatedTokens: 150000, // Over 4o limit
        requiresTools: true,
        isRealtime: true,
        complexity: 'high',
      };
      
      const config = ModelSelector.selectModel(criteria);
      expect(config.model).toBe('gpt-4o');
      expect(config.reasoning).toContain('will need to chunk');
    });

    it('should set appropriate temperature for different tasks', () => {
      const extractionConfig = ModelSelector.selectModel({
        taskType: 'extraction',
        estimatedTokens: 1000,
        requiresTools: false,
        isRealtime: false,
        complexity: 'low',
      });
      expect(extractionConfig.temperature).toBe(0.1);

      const generationConfig = ModelSelector.selectModel({
        taskType: 'generation',
        estimatedTokens: 1000,
        requiresTools: false,
        isRealtime: false,
        complexity: 'medium',
      });
      expect(generationConfig.temperature).toBe(0.8);

      const chatConfig = ModelSelector.selectModel({
        taskType: 'chat',
        estimatedTokens: 1000,
        requiresTools: true,
        isRealtime: true,
        complexity: 'medium',
      });
      expect(chatConfig.temperature).toBe(0.7);
    });
  });

  describe('executeWithFallback', () => {
    it('should return primary model result on success', async () => {
      const mockExecute = jest.fn().mockResolvedValue('success');
      const primaryConfig = { model: 'gpt-4o', temperature: 0.7, maxTokens: 1000 };
      const fallbackConfig = { model: 'o3-mini', temperature: 0.7, maxTokens: 1000 };

      const result = await ModelSelector.executeWithFallback(
        primaryConfig,
        fallbackConfig,
        mockExecute
      );

      expect(result.result).toBe('success');
      expect(result.modelUsed).toBe('gpt-4o');
      expect(result.fallback).toBe(false);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should fallback on rate limit error', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      
      const mockExecute = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('fallback success');

      const primaryConfig = { model: 'gpt-4o', temperature: 0.7, maxTokens: 1000 };
      const fallbackConfig = { model: 'o3-mini', temperature: 0.7, maxTokens: 1000 };

      const result = await ModelSelector.executeWithFallback(
        primaryConfig,
        fallbackConfig,
        mockExecute
      );

      expect(result.result).toBe('fallback success');
      expect(result.modelUsed).toBe('o3-mini');
      expect(result.fallback).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should fallback on service unavailable', async () => {
      const error = new Error('Service unavailable') as any;
      error.status = 503;
      
      const mockExecute = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('fallback success');

      const primaryConfig = { model: 'gpt-4o', temperature: 0.7, maxTokens: 1000 };
      const fallbackConfig = { model: 'o3-mini', temperature: 0.7, maxTokens: 1000 };

      const result = await ModelSelector.executeWithFallback(
        primaryConfig,
        fallbackConfig,
        mockExecute
      );

      expect(result.result).toBe('fallback success');
      expect(result.modelUsed).toBe('o3-mini');
      expect(result.fallback).toBe(true);
    });

    it('should throw if both models fail', async () => {
      const primaryError = new Error('Primary failed') as any;
      primaryError.status = 429;
      const fallbackError = new Error('Fallback failed');

      const mockExecute = jest.fn()
        .mockRejectedValueOnce(primaryError)
        .mockRejectedValueOnce(fallbackError);

      const primaryConfig = { model: 'gpt-4o', temperature: 0.7, maxTokens: 1000 };
      const fallbackConfig = { model: 'o3-mini', temperature: 0.7, maxTokens: 1000 };

      await expect(
        ModelSelector.executeWithFallback(primaryConfig, fallbackConfig, mockExecute)
      ).rejects.toThrow('Both models failed');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens roughly', () => {
      expect(ModelSelector.estimateTokens('Hello world')).toBe(3); // 11 chars / 4
      expect(ModelSelector.estimateTokens('A'.repeat(100))).toBe(25); // 100 / 4
      expect(ModelSelector.estimateTokens('')).toBe(0);
    });
  });

  describe('Context Pruning', () => {
    it('should recommend pruning at 80% capacity', () => {
      // GPT-4o has 128k context
      expect(ModelSelector.shouldPruneContext(100000, 'gpt-4o')).toBe(false);
      expect(ModelSelector.shouldPruneContext(103000, 'gpt-4o')).toBe(true); // >80%
      
      // O3 has 32k context
      expect(ModelSelector.shouldPruneContext(25000, 'o3-mini')).toBe(false);
      expect(ModelSelector.shouldPruneContext(26000, 'o3-mini')).toBe(true); // >80%
    });
  });

  describe('Cost Estimation', () => {
    it('should calculate costs correctly', () => {
      const gpt4oCost = ModelSelector.getCostEstimate(1000000, 500000, 'gpt-4o');
      // Input: 1M tokens * $5/M = $5
      // Output: 0.5M tokens * $15/M = $7.5
      expect(gpt4oCost).toBe(12.5);

      const o3Cost = ModelSelector.getCostEstimate(1000000, 500000, 'o3-mini');
      // Input: 1M tokens * $3/M = $3
      // Output: 0.5M tokens * $12/M = $6
      expect(o3Cost).toBe(9);
    });
  });

  describe('Helper Functions', () => {
    it('should select appropriate model for chat context', () => {
      const simpleContext = {
        recentMessages: [{ content: 'Hello' }, { content: 'Hi there' }],
        memories: [{ content: 'User likes strength training' }],
      };
      
      const config = getModelForChat(simpleContext);
      expect(config.model).toBe('gpt-4o');
      expect(config.temperature).toBe(0.7);
    });

    it('should select O3 for summarization', () => {
      const longContent = 'Lorem ipsum '.repeat(1000);
      const config = getModelForSummarization(longContent);
      expect(config.model).toBe('o3-mini');
      expect(config.maxTokens).toBe(500); // Summaries should be concise
    });
  });
});