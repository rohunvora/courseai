import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, chatHistory, courses } from '../db/index.js';
import { OpenAIServiceWithTools } from '../services/openai-tools.js';
import { getMemoryService } from '../services/memory.js';
import { ChatMessageSchema, StreamToken, ChatResponse } from '../types/index.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

let openai: OpenAIServiceWithTools;
let memoryService: ReturnType<typeof getMemoryService>;

export async function chatRoutesWithTools(fastify: FastifyInstance) {
  // Stream chat endpoint with function calling
  fastify.post<{
    Params: { courseId: string };
    Body: z.infer<typeof ChatMessageSchema>;
  }>('/api/chat/:courseId/message', async (request: FastifyRequest<{ Params: { courseId: string }; Body: z.infer<typeof ChatMessageSchema> }>, reply: FastifyReply) => {
    const { courseId } = request.params;
    const { message, sessionId, context } = request.body;
    const requestId = request.headers['x-request-id'] as string || uuidv4();

    try {
      // Initialize services if not already done
      if (!openai) {
        openai = new OpenAIServiceWithTools();
      }
      if (!memoryService) {
        memoryService = getMemoryService();
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

      // Get recent workouts and relevant memories
      const [recentWorkouts, relevantMemories] = await Promise.all([
        memoryService.getRecentWorkouts(course.userId, courseId),
        memoryService.getRelevantMemories(course.userId, message, { courseId, limit: 5 })
      ]);

      const workoutContext = recentWorkouts.map(w => {
        const data = w.data as any;
        const metrics = w.metrics as any;
        return {
          exercise: data.exercise,
          sets: data.sets,
          totalVolume: metrics?.totalVolume,
          timestamp: w.timestamp,
        };
      });
      
      // Add memories to message context as assistant context (no system messages for OpenAI service)
      const memoryContextString = relevantMemories.length > 0 
        ? `Previous context: ${relevantMemories.map(m => m.content).join('; ')}`
        : '';
      
      // Only include user/assistant messages for the OpenAI service
      const enhancedMessageContext = messageContext;

      // Save user message
      await db.insert(chatHistory).values({
        courseId,
        sessionId: sessionId || null,
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
          // Stream tokens with tool support
          const { textStream, toolCallsPromise } = await openai.streamChatResponseWithTools(message, {
            userId: course.userId,
            courseId,
            sessionId,
            topic: course.topic,
            recentMessages: enhancedMessageContext,
            currentExercise: context?.current_exercise,
            recentWorkouts: workoutContext,
            relevantMemories,
            courseStartDate: course.createdAt,
            personalRecords: [], // TODO: Calculate from workouts
          });

          // Stream text tokens
          for await (const token of textStream) {
            assistantResponse += token;
            
            const streamData: StreamToken = {
              type: 'token',
              content: token,
              messageId,
            };
            
            reply.raw.write(`data: ${JSON.stringify(streamData)}\n\n`);
            // Force flush to ensure immediate delivery
            if (reply.raw.flush) reply.raw.flush();
          }

          // Wait for tool calls to complete
          const toolResults = await toolCallsPromise;
          
          // Include tool results in the response
          let autoLogged: any = undefined;
          if (toolResults.length > 0) {
            // Find successful workout logs
            const workoutLogs = toolResults.filter(
              r => r.toolName === 'log_workout' && r.result?.success
            );
            
            if (workoutLogs.length > 0) {
              // Convert to expected format
              const firstLog = workoutLogs[0];
              autoLogged = {
                id: firstLog.result.id,
                activityType: 'exercise',
                data: firstLog.result,
                notes: undefined
              };
            }
          }

          // Save assistant response
          await db.insert(chatHistory).values({
            courseId,
            sessionId: sessionId || null,
            messageType: 'assistant',
            content: assistantResponse,
            context: { toolCalls: toolResults },
            requestId,
          });
          
          // Queue memories for embedding
          await memoryService.queueChatMemory(
            course.userId,
            courseId,
            message,
            assistantResponse
          );
          
          // Queue workout memories if any were logged
          if (toolResults.length > 0) {
            const workoutLogs = toolResults.filter(
              r => r.toolName === 'log_workout' && r.result?.success
            );
            
            for (const log of workoutLogs) {
              await memoryService.queueWorkoutMemory(
                course.userId,
                courseId,
                log.result
              );
            }
          }

          // Send completion event
          const completeData: StreamToken = {
            type: 'complete',
            messageId,
            autoLogged,
          };
          
          reply.raw.write(`data: ${JSON.stringify(completeData)}\n\n`);
          if (reply.raw.flush) reply.raw.flush();
          reply.raw.end();

        } catch {
          const errorData: StreamToken = {
            type: 'error',
            error: 'Failed to generate response',
          };
          reply.raw.write(`data: ${JSON.stringify(errorData)}\n\n`);
          if (reply.raw.flush) reply.raw.flush();
          reply.raw.end();
        }
      } else {
        // Non-streaming response with tools
        const { response, toolCalls } = await openai.getChatResponseWithTools(message, {
          userId: course.userId,
          courseId,
          sessionId,
          topic: course.topic,
          recentMessages: enhancedMessageContext,
          currentExercise: context?.current_exercise,
          recentWorkouts: workoutContext,
          relevantMemories,
          courseStartDate: course.createdAt,
          personalRecords: [], // TODO: Calculate from workouts
        });

        // Include tool results in the response
        let autoLogged: any = undefined;
        if (toolCalls.length > 0) {
          const workoutLogs = toolCalls.filter(
            r => r.toolName === 'log_workout' && r.result?.success
          );
          
          if (workoutLogs.length > 0) {
            // Convert to expected format
            const firstLog = workoutLogs[0];
            autoLogged = {
              id: firstLog.result.id,
              activityType: 'exercise',
              data: firstLog.result,
              notes: undefined
            };
          }
        }

        // Save assistant response
        await db.insert(chatHistory).values({
          courseId,
          sessionId: sessionId || null,
          messageType: 'assistant',
          content: response,
          context: { toolCalls },
          requestId,
        });
        
        // Queue memories for embedding
        await memoryService.queueChatMemory(
          course.userId,
          courseId,
          message,
          response
        );
        
        // Queue workout memories if any were logged
        if (toolCalls.length > 0) {
          const workoutLogs = toolCalls.filter(
            r => r.toolName === 'log_workout' && r.result?.success
          );
          
          for (const log of workoutLogs) {
            await memoryService.queueWorkoutMemory(
              course.userId,
              courseId,
              log.result
            );
          }
        }

        const chatResponse: ChatResponse = {
          requestId,
          response,
          autoLogged,
        };

        return reply.send({
          success: true,
          data: chatResponse,
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