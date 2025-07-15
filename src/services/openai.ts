import OpenAI from 'openai';
import { config } from '../config/env.js';
import { buildBasicChatPrompt, buildCourseGeneratorPrompt } from '../config/prompts.js';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async streamChatResponse(
    message: string,
    context: {
      courseId: string;
      topic?: string;
      recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentExercise?: any;
    }
  ): Promise<AsyncIterable<string>> {
    const systemPrompt = this.buildSystemPrompt(context);
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(context.recentMessages || []),
      { role: 'user', content: message },
    ];

    const stream = await this.client.chat.completions.create({
      model: config.openai.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return this.extractTokens(stream);
  }

  private buildSystemPrompt(context: { courseId: string; topic?: string; currentExercise?: any }): string {
    return buildBasicChatPrompt(context);
  }

  private async *extractTokens(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): AsyncIterable<string> {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  async generateCourseOutline(topic: string, level: string, goals?: string[]): Promise<any> {
    const prompt = buildCourseGeneratorPrompt(topic, level, goals);

    const response = await this.client.chat.completions.create({
      model: config.openai.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return JSON.parse(content);
  }

  // Extract activity data from user message for auto-logging
  async extractActivityData(message: string, context: any): Promise<any | null> {
    const prompt = `Analyze this user message for workout/activity data that should be logged:
    
Message: "${message}"
Context: ${JSON.stringify(context)}

If the message contains specific activity data (exercise name, weight, reps, sets, time, etc.), return a JSON object:
{
  "activityType": "exercise|reading|practice|quiz",
  "data": {
    "exercise": "exercise name",
    "weight": "weight with unit",
    "sets": number,
    "reps": number or array,
    "duration": "time if applicable",
    "notes": "any additional notes"
  },
  "needsAttention": boolean (true if form issues or pain mentioned)
}

If no activity data is present, return null.`;

    try {
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      return parsed.activityType ? parsed : null;
    } catch (error) {
      console.error('Error extracting activity data:', error);
      return null;
    }
  }
}