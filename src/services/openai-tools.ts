import OpenAI from 'openai';
import { tools, executeTool } from './tools';
import { config } from '../config/env.js';
import { buildMainChatPrompt, selectPromptVariant, computeUserSegment, SAFETY_RULES } from '../config/prompts.js';

export interface StreamWithTools {
  textStream: AsyncIterable<string>;
  toolCallsPromise: Promise<any[]>;
}

export class OpenAIServiceWithTools {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async streamChatResponseWithTools(
    message: string,
    context: {
      userId: string;
      courseId: string;
      sessionId?: string;
      topic?: string;
      recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentExercise?: any;
      recentWorkouts?: any[];
      personalRecords?: any[];
    }
  ): Promise<StreamWithTools> {
    const systemPrompt = this.buildSystemPrompt(context);
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(context.recentMessages || []),
      { role: 'user', content: message },
    ];

    const stream = await this.client.chat.completions.create({
      model: config.openai.model,
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Collect tool calls and text separately
    const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
    const textChunks: string[] = [];
    let currentToolCall: Partial<OpenAI.Chat.Completions.ChatCompletionMessageToolCall> | null = null;

    const textStream = this.processStream(stream, toolCalls, textChunks, currentToolCall);
    
    // Execute tool calls after stream completes
    const toolCallsPromise = this.executeToolCalls(toolCalls, context);

    return {
      textStream,
      toolCallsPromise,
    };
  }

  private async *processStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    textChunks: string[],
    currentToolCall: Partial<OpenAI.Chat.Completions.ChatCompletionMessageToolCall> | null
  ): AsyncIterable<string> {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      // Handle text content
      if (delta?.content) {
        textChunks.push(delta.content);
        yield delta.content;
      }
      
      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.id) {
            // New tool call
            if (currentToolCall) {
              toolCalls.push(currentToolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall);
            }
            currentToolCall = {
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || '',
              },
            };
          } else if (currentToolCall && toolCall.function?.arguments) {
            // Append to current tool call arguments
            currentToolCall.function!.arguments += toolCall.function.arguments;
          }
        }
      }
    }
    
    // Add the last tool call if exists
    if (currentToolCall && currentToolCall.id) {
      toolCalls.push(currentToolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall);
    }
  }

  private async executeToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    context: { userId: string; courseId: string; sessionId?: string }
  ): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args, context);
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          result,
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return results;
  }

  private buildSystemPrompt(context: any): string {
    const recentWorkouts = context.recentWorkouts || [];
    const personalRecords = context.personalRecords || [];
    const memories = context.relevantMemories || [];
    
    // Calculate days since last workout
    const lastWorkoutDays = recentWorkouts.length > 0 
      ? Math.floor((Date.now() - new Date(recentWorkouts[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    // Determine current training phase/week
    const courseStartDate = context.courseStartDate;
    const currentWeek = courseStartDate 
      ? Math.ceil((Date.now() - new Date(courseStartDate).getTime()) / (1000 * 60 * 60 * 24 * 7))
      : 1;
    
    // Get user segment and select prompt variant
    const userSegment = computeUserSegment(context.user || {});
    const variant = selectPromptVariant(context.userId, context.sessionId || 'default', userSegment);
    
    // Check for safety keywords in recent messages
    const recentText = context.recentMessages?.map(m => m.content).join(' ').toLowerCase() || '';
    const hasSafetyKeyword = ['pain', 'hurt', 'injury'].some(word => recentText.includes(word));
    
    // Apply contextual safety rules if needed
    let additionalSafety = '';
    if (hasSafetyKeyword && variant.safetyLevel === 'contextual') {
      const keyword = ['pain', 'hurt', 'injury'].find(word => recentText.includes(word));
      additionalSafety = SAFETY_RULES.contextual(keyword || '');
    }
    
    const promptContext = {
      topic: context.topic,
      currentWeek,
      lastWorkoutDays,
      currentExercise: context.currentExercise,
      personalRecords,
      recentWorkouts,
      memories
    };
    
    let prompt = buildMainChatPrompt(promptContext, variant, userSegment);
    
    // Add additional safety context if needed
    if (additionalSafety) {
      prompt = prompt + '\n\nIMPORTANT: ' + additionalSafety;
    }
    
    // Store variant info for analytics
    if (context.sessionId) {
      // This would be logged to analytics in production
      console.log('Prompt variant selected:', variant.id, 'for segment:', userSegment.type);
    }
    
    return prompt;
  }

  // Backward compatibility - non-streaming version with tools
  async getChatResponseWithTools(
    message: string,
    context: any
  ): Promise<{ response: string; toolCalls: any[] }> {
    const systemPrompt = this.buildSystemPrompt(context);
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(context.recentMessages || []),
      { role: 'user', content: message },
    ];

    const completion = await this.client.chat.completions.create({
      model: config.openai.model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const message_content = completion.choices[0]?.message?.content || '';
    const tool_calls = completion.choices[0]?.message?.tool_calls || [];

    // Execute tool calls
    const toolResults = await this.executeToolCalls(tool_calls, context);

    return {
      response: message_content,
      toolCalls: toolResults,
    };
  }
}