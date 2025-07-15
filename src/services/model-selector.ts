import { config } from '../config/env.js';

export type ModelType = 'gpt-4o' | 'o3-mini';

export interface ModelSelectionCriteria {
  taskType: 'chat' | 'summarization' | 'extraction' | 'generation';
  estimatedTokens: number;
  requiresTools: boolean;
  isRealtime: boolean;
  complexity: 'low' | 'medium' | 'high';
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  reasoning?: string;
}

export class ModelSelector {
  private static readonly MODEL_CONFIGS = {
    'gpt-4o': {
      name: 'gpt-4o',
      contextWindow: 128000,
      costPerMillionTokens: { input: 5, output: 15 },
      latencyMs: 1500,
      capabilities: {
        functionCalling: 'excellent',
        reasoning: 'excellent',
        speed: 'fast'
      }
    },
    'o3-mini': {
      name: 'o3-mini',
      contextWindow: 32000,
      costPerMillionTokens: { input: 3, output: 12 },
      latencyMs: 4000,
      capabilities: {
        functionCalling: 'good',
        reasoning: 'very-good',
        speed: 'moderate'
      }
    }
  };

  static selectModel(criteria: ModelSelectionCriteria): ModelConfig {
    const { taskType, estimatedTokens, requiresTools, isRealtime, complexity } = criteria;
    
    // Decision tree for model selection
    let selectedModel: ModelType = 'gpt-4o'; // default
    let reasoning = '';

    // Rule 1: Use o3 for large summarization tasks
    if (taskType === 'summarization' && estimatedTokens > 10000) {
      selectedModel = 'o3-mini';
      reasoning = 'Large summarization task - o3 is more cost-effective';
    }
    // Rule 2: Always use 4o for tool-heavy real-time interactions
    else if (requiresTools && isRealtime) {
      selectedModel = 'gpt-4o';
      reasoning = 'Real-time tool usage requires 4o for best performance';
    }
    // Rule 3: Use o3 for batch processing and background jobs
    else if (!isRealtime && taskType !== 'chat') {
      selectedModel = 'o3-mini';
      reasoning = 'Background processing - o3 provides good value';
    }
    // Rule 4: Check token limits
    else if (estimatedTokens > this.MODEL_CONFIGS['gpt-4o'].contextWindow) {
      // This shouldn't happen with proper token management, but fallback to chunking
      selectedModel = 'gpt-4o';
      reasoning = 'Token limit exceeded - will need to chunk';
    }
    // Rule 5: Low complexity background tasks use o3
    else if (complexity === 'low' && !isRealtime) {
      selectedModel = 'o3-mini';
      reasoning = 'Simple background task - o3 is sufficient';
    }

    // Temperature selection based on task
    let temperature = 0.7; // default
    if (taskType === 'extraction') {
      temperature = 0.1; // Low temp for consistent extraction
    } else if (taskType === 'generation') {
      temperature = 0.8; // Higher temp for creative generation
    }

    // Max tokens based on task
    let maxTokens = 1000; // default
    if (taskType === 'summarization') {
      maxTokens = 500; // Summaries should be concise
    } else if (taskType === 'generation') {
      maxTokens = 2000; // More room for generation
    }

    return {
      model: this.MODEL_CONFIGS[selectedModel].name,
      temperature,
      maxTokens,
      reasoning
    };
  }

  static async executeWithFallback<T>(
    primaryModel: ModelConfig,
    fallbackModel: ModelConfig,
    executeFunc: (model: string) => Promise<T>
  ): Promise<{ result: T; modelUsed: string; fallback: boolean }> {
    try {
      const result = await executeFunc(primaryModel.model);
      return { result, modelUsed: primaryModel.model, fallback: false };
    } catch (error: any) {
      // Check if it's a rate limit or model availability error
      if (error.status === 429 || error.status === 503) {
        console.log(`Falling back from ${primaryModel.model} to ${fallbackModel.model}`);
        try {
          const result = await executeFunc(fallbackModel.model);
          return { result, modelUsed: fallbackModel.model, fallback: true };
        } catch (fallbackError) {
          throw new Error(`Both models failed. Primary: ${error.message}, Fallback: ${fallbackError}`);
        }
      }
      throw error;
    }
  }

  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  static shouldPruneContext(
    currentTokens: number,
    modelType: ModelType = 'gpt-4o'
  ): boolean {
    const maxContext = this.MODEL_CONFIGS[modelType].contextWindow;
    // Start pruning at 80% of context window
    return currentTokens > maxContext * 0.8;
  }

  static getCostEstimate(
    inputTokens: number,
    outputTokens: number,
    modelType: ModelType
  ): number {
    const config = this.MODEL_CONFIGS[modelType];
    const inputCost = (inputTokens / 1_000_000) * config.costPerMillionTokens.input;
    const outputCost = (outputTokens / 1_000_000) * config.costPerMillionTokens.output;
    return inputCost + outputCost;
  }
}

// Example usage in services
export function getModelForChat(context: any): ModelConfig {
  const estimatedTokens = ModelSelector.estimateTokens(
    JSON.stringify(context.recentMessages || []) +
    JSON.stringify(context.memories || [])
  );

  return ModelSelector.selectModel({
    taskType: 'chat',
    estimatedTokens,
    requiresTools: true,
    isRealtime: true,
    complexity: context.memories?.length > 10 ? 'high' : 'medium'
  });
}

export function getModelForSummarization(content: string): ModelConfig {
  return ModelSelector.selectModel({
    taskType: 'summarization',
    estimatedTokens: ModelSelector.estimateTokens(content),
    requiresTools: false,
    isRealtime: false,
    complexity: 'low'
  });
}