import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, chatHistory, courses, progressLogs } from '../db/index.js';
import { OpenAIService } from '../services/openai.js';
import { ChatMessageSchema, StreamToken, ChatResponse } from '../types/index.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

let openai: OpenAIService;

export async function chatRoutes(fastify: FastifyInstance) {
  // Stream chat endpoint
  fastify.post<{
    Params: { courseId: string };
    Body: z.infer<typeof ChatMessageSchema>;
  }>('/api/chat/:courseId/message', async (request: FastifyRequest<{ Params: { courseId: string }; Body: z.infer<typeof ChatMessageSchema> }>, reply: FastifyReply) => {
    const { courseId } = request.params;
    const { message, sessionId, context } = request.body;
    const requestId = request.headers['x-request-id'] as string || uuidv4();

    try {
      // Initialize OpenAI service if not already done
      if (!openai) {
        openai = new OpenAIService();
      }

      // Get course info
      const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId),
      });

      if (!course) {
        return reply.status(404).send({ error: 'Course not found' });
      }

      // Get recent chat history for context
      const recentMessages = await db.query.chatHistory.findMany({
        where: eq(chatHistory.courseId, courseId),
        orderBy: desc(chatHistory.timestamp),
        limit: 10,
      });

      const messageContext = recentMessages
        .reverse()
        .map(msg => ({
          role: msg.messageType as 'user' | 'assistant',
          content: msg.content,
        }));

      // Save user message
      await db.insert(chatHistory).values({
        courseId,
        sessionId,
        messageType: 'user',
        content: message,
        context,
        requestId,
      });

      // Check if client wants streaming
      const acceptHeader = request.headers.accept;
      const isStreaming = acceptHeader?.includes('text/event-stream');

      if (isStreaming) {
        // Set up SSE headers
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        });

        let assistantResponse = '';
        const messageId = uuidv4();

        try {
          // Stream tokens
          const stream = await openai.streamChatResponse(message, {
            courseId,
            topic: course.topic,
            recentMessages: messageContext,
            currentExercise: context?.current_exercise,
          });

          for await (const token of stream) {
            assistantResponse += token;
            
            const streamData: StreamToken = {
              type: 'token',
              content: token,
              messageId,
            };
            
            reply.raw.write(`data: ${JSON.stringify(streamData)}\n\n`);
          }

          // Extract activity data for auto-logging
          const activityData = await openai.extractActivityData(message, context);
          let autoLogged = null;

          if (activityData && sessionId) {
            const logEntry = await db.insert(progressLogs).values({
              userId: course.userId,
              courseId,
              sessionId,
              activityType: activityData.activityType,
              data: activityData.data,
              notes: activityData.needsAttention ? 'Needs attention - form/safety concern' : undefined,
            }).returning();

            autoLogged = {
              id: logEntry[0].id,
              activityType: activityData.activityType,
              data: activityData.data,
              needsAttention: activityData.needsAttention,
            };
          }

          // Save assistant response
          await db.insert(chatHistory).values({
            courseId,
            sessionId,
            messageType: 'assistant',
            content: assistantResponse,
            requestId,
          });

          // Send completion event
          const completeData: StreamToken = {
            type: 'complete',
            messageId,
            autoLogged,
          };
          
          reply.raw.write(`data: ${JSON.stringify(completeData)}\n\n`);
          reply.raw.end();

        } catch (streamError) {
          const errorData: StreamToken = {
            type: 'error',
            error: 'Failed to generate response',
          };
          reply.raw.write(`data: ${JSON.stringify(errorData)}\n\n`);
          reply.raw.end();
        }
      } else {
        // Non-streaming response
        let assistantResponse = '';
        
        const stream = await openai.streamChatResponse(message, {
          courseId,
          topic: course.topic,
          recentMessages: messageContext,
          currentExercise: context?.current_exercise,
        });

        for await (const token of stream) {
          assistantResponse += token;
        }

        // Extract activity data for auto-logging
        const activityData = await openai.extractActivityData(message, context);
        let autoLogged = null;

        if (activityData && sessionId) {
          const logEntry = await db.insert(progressLogs).values({
            userId: course.userId,
            courseId,
            sessionId,
            activityType: activityData.activityType,
            data: activityData.data,
            notes: activityData.needsAttention ? 'Needs attention - form/safety concern' : undefined,
          }).returning();

          autoLogged = {
            id: logEntry[0].id,
            activityType: activityData.activityType,
            data: activityData.data,
            needsAttention: activityData.needsAttention,
          };
        }

        // Save assistant response
        await db.insert(chatHistory).values({
          courseId,
          sessionId,
          messageType: 'assistant',
          content: assistantResponse,
          requestId,
        });

        const response: ChatResponse = {
          requestId,
          response: assistantResponse,
          autoLogged,
        };

        return reply.send({
          success: true,
          data: response,
          meta: { requestId, timestamp: new Date() },
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      if (reply.raw.headersSent) {
        const errorData: StreamToken = {
          type: 'error',
          error: 'Internal server error',
        };
        reply.raw.write(`data: ${JSON.stringify(errorData)}\n\n`);
        reply.raw.end();
      } else {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'CHAT_ERROR',
            message: 'Failed to process chat message',
          },
          meta: { requestId, timestamp: new Date() },
        });
      }
    }
  });

  // Get chat history
  fastify.get<{
    Params: { courseId: string };
    Querystring: { limit?: number; sessionId?: string };
  }>('/api/chat/:courseId/history', async (request, reply) => {
    const { courseId } = request.params;
    const { limit, sessionId } = request.query;

    try {
      let query = db.query.chatHistory.findMany({
        where: eq(chatHistory.courseId, courseId),
        orderBy: desc(chatHistory.timestamp),
        limit,
      });

      if (sessionId) {
        query = db.query.chatHistory.findMany({
          where: eq(chatHistory.sessionId, sessionId),
          orderBy: desc(chatHistory.timestamp),
          limit,
        });
      }

      const messages = await query;

      return reply.send({
        success: true,
        data: messages.reverse(),
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch chat history',
        },
      });
    }
  });
}