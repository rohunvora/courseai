// Model service - GPT-4o only, no fallbacks

export type ModelType = 'gpt-4o';

export interface ModelConfig {
  model: 'gpt-4o';
  temperature: number;
  maxTokens: number;
}

export class ModelError extends Error {
  constructor(message: string, public code: string = 'AI_UNAVAILABLE') {
    super(message);
    this.name = 'ModelError';
  }
}

export class ModelSelector {
  private static readonly GPT4O_CONFIG = {
    name: 'gpt-4o' as const,
    contextWindow: 128000,
    costPerMillionTokens: { input: 5, output: 15 },
    latencyMs: 1500
  };

  static getModelConfig(taskType: 'chat' | 'summarization' | 'extraction' | 'generation' = 'chat'): ModelConfig {
    // No model selection - always GPT-4o, fail hard if unavailable
    
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
      model: this.GPT4O_CONFIG.name,
      temperature,
      maxTokens
    };
  }

  static async executeWithoutFallback<T>(
    model: ModelConfig,
    executeFunc: (model: string) => Promise<T>
  ): Promise<{ result: T; modelUsed: string }> {
    try {
      // No fallback - let errors propagate with proper typing
      const result = await executeFunc(model.model);
      return { result, modelUsed: model.model };
    } catch (error) {
      // Re-throw as ModelError for proper error handling
      if (error instanceof Error) {
        throw new ModelError(`GPT-4o unavailable: ${error.message}`, 'AI_UNAVAILABLE');
      }
      throw new ModelError('GPT-4o unavailable: Unknown error', 'AI_UNAVAILABLE');
    }
  }

  static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  static shouldPruneContext(currentTokens: number): boolean {
    const maxContext = this.GPT4O_CONFIG.contextWindow;
    // Start pruning at 80% of context window to avoid hitting limits
    return currentTokens > maxContext * 0.8;
  }

  static getCostEstimate(inputTokens: number, outputTokens: number): number {
    const config = this.GPT4O_CONFIG;
    const inputCost = (inputTokens / 1_000_000) * config.costPerMillionTokens.input;
    const outputCost = (outputTokens / 1_000_000) * config.costPerMillionTokens.output;
    return inputCost + outputCost;
  }

  static validateTokenLimit(estimatedTokens: number): void {
    if (estimatedTokens > this.GPT4O_CONFIG.contextWindow) {
      throw new ModelError(
        `Token count ${estimatedTokens} exceeds GPT-4o limit ${this.GPT4O_CONFIG.contextWindow}`,
        'TOKEN_LIMIT_EXCEEDED'
      );
    }
  }
}

// Simplified usage functions - no model selection, just configuration
export function getModelForChat(): ModelConfig {
  return ModelSelector.getModelConfig('chat');
}

export function getModelForSummarization(): ModelConfig {
  return ModelSelector.getModelConfig('summarization');
}