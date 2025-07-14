import OpenAI from 'openai';

export class OpenAIService {
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
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return this.extractTokens(stream);
  }

  private buildSystemPrompt(context: { courseId: string; topic?: string; currentExercise?: any }): string {
    return `You are an AI fitness and learning coach helping a user with their personalized course: "${context.topic || 'Unknown Course'}".

Key responsibilities:
1. Provide helpful, encouraging guidance
2. Answer questions about form, technique, and progress
3. Automatically detect when user mentions specific activities/exercises and note the details
4. Keep responses conversational but informative
5. If user reports pain or discomfort, prioritize safety and suggest form corrections

Current context: ${context.currentExercise ? `User is working on ${context.currentExercise}` : 'General conversation'}

Be supportive, knowledgeable, and safety-focused. Keep responses concise but helpful.`;
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
    const prompt = `Create a structured course outline for: "${topic}" at ${level} level.
    
Goals: ${goals?.join(', ') || 'General improvement'}

Return a JSON object with this structure:
{
  "title": "Course Title",
  "description": "Brief description",
  "estimatedWeeks": 8,
  "modules": [
    {
      "id": "module-1",
      "title": "Module Title",
      "description": "Module description",
      "estimatedHours": 4,
      "lessons": [
        {
          "id": "lesson-1",
          "title": "Lesson Title",
          "type": "lesson|practice|quiz",
          "estimatedMinutes": 30
        }
      ]
    }
  ]
}

Make it practical and progressive.`;

    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
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
        model: process.env.OPENAI_MODEL || 'gpt-4o',
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