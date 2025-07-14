import OpenAI from 'openai';
import { tools, executeTool } from './tools';

export interface StreamWithTools {
  textStream: AsyncIterable<string>;
  toolCallsPromise: Promise<any[]>;
}

export class OpenAIServiceWithTools {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.client = new OpenAI({
      apiKey,
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
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
    
    return `You are an AI fitness and learning coach helping a user with their personalized course: "${context.topic || 'Unknown Course'}".

Key responsibilities:
1. Provide helpful, encouraging guidance
2. Answer questions about form, technique, and progress
3. Use the log_workout function when users mention specific exercises with sets/reps/weights
4. Use update_progress when users want to correct or modify previous workout entries
5. Use get_progress_summary when users ask about their progress, personal records, or workout statistics
6. Use update_course_goal when users want to change their goals, timeline, or training focus
7. Keep responses conversational but informative
8. If user reports pain or discomfort, prioritize safety and suggest form corrections
9. When tools succeed, provide brief confirmation messages like "✅ Progress updated!" or "✅ Workout logged!"

CAPABILITIES:
- You can log workouts using the log_workout function when users mention exercises with specific sets, reps, and weights
- Example: "I did 3 sets of bench press at 135 lbs for 10, 8, and 6 reps" should trigger log_workout
- You can update previous entries using update_progress when users correct data
- Example: "Actually that last set was 145 lbs, not 135" should trigger update_progress
- You can get progress summaries using get_progress_summary for questions about statistics
- Example: "What's my best bench press?" or "How much volume did I do this week?" should trigger get_progress_summary
- You can update course goals using update_course_goal when users want to change focus or timeline
- Example: "I want to focus more on endurance now" should trigger update_course_goal

${recentWorkouts.length > 0 ? `
RECENT WORKOUTS:
${recentWorkouts.map((w: any) => `- ${w.exercise}: ${w.sets} sets, ${w.totalVolume} lbs total volume`).join('\n')}
` : ''}

${personalRecords.length > 0 ? `
PERSONAL RECORDS:
${personalRecords.map((pr: any) => `- ${pr.exercise}: ${pr.weight} ${pr.unit}`).join('\n')}
` : ''}

Current context: ${context.currentExercise ? `User is working on ${context.currentExercise}` : 'General conversation'}

Be supportive, knowledgeable, and safety-focused. Keep responses concise but helpful. When users mention specific workout data, use the log_workout function to save it.`;
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
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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