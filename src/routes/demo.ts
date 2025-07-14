import { FastifyInstance } from 'fastify';
import { OpenAIService } from '../services/openai.js';
import { StreamToken } from '../types/index.js';

export async function demoRoutes(fastify: FastifyInstance) {
  // Demo endpoint that works without database
  fastify.post('/api/demo/chat', async (request, reply) => {
    const { message } = request.body as { message: string };
    
    try {
      const openai = new OpenAIService();
      
      // Set up SSE headers for streaming
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      
      let _assistantResponse = '';
      
      // Stream the response
      const stream = await openai.streamChatResponse(message, {
        courseId: 'demo-course',
        topic: 'Fitness Training',
        currentExercise: 'general fitness'
      });
      
      for await (const token of stream) {
        _assistantResponse += token;
        
        const streamData: StreamToken = {
          type: 'token',
          content: token,
        };
        
        reply.raw.write(`data: ${JSON.stringify(streamData)}\n\n`);
      }
      
      // Extract activity data if it's a workout message
      const activityData = await openai.extractActivityData(message, { type: 'workout' });
      
      if (activityData) {
        // Include activity data in completion
      }
      
      // Send completion
      const completeData: StreamToken = {
        type: 'complete',
      };
      reply.raw.write(`data: ${JSON.stringify(completeData)}\n\n`);
      reply.raw.end();
      
    } catch (error) {
      console.error('Demo chat error:', error);
      const errorData: StreamToken = {
        type: 'error',
        error: 'Failed to process message',
      };
      reply.raw.write(`data: ${JSON.stringify(errorData)}\n\n`);
      reply.raw.end();
    }
  });
}