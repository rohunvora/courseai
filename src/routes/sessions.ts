import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, sessions } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const CreateSessionSchema = z.object({
  courseId: z.string().uuid(),
  sessionType: z.enum(['practice', 'learning', 'assessment']),
  plannedDuration: z.number().optional(),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  // Create session
  fastify.post<{
    Body: z.infer<typeof CreateSessionSchema>;
  }>('/api/sessions', async (request, reply) => {
    try {
      const validation = CreateSessionSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: { type: 'validation_error', message: validation.error.issues[0].message }
        });
      }
      
      const { courseId, sessionType, plannedDuration } = validation.data;
      
      // For now, use the demo user ID
      const userId = '00000000-0000-0000-0000-000000000001';
      
      // Create session
      const newSession = await db.insert(sessions).values({
        id: uuidv4(),
        userId,
        courseId,
        sessionType,
        status: 'active',
        plannedDuration,
        startedAt: new Date(),
      }).returning();
      
      return reply.status(201).send({
        success: true,
        data: newSession[0],
      });
    } catch (error) {
      fastify.log.error('Error creating session:', error);
      return reply.status(500).send({
        success: false,
        error: { 
          type: 'server_error', 
          message: 'Failed to create session',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  });
  
  // Get session by ID
  fastify.get<{
    Params: { sessionId: string };
  }>('/api/sessions/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      
      const session = await db.query.sessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, sessionId),
      });
      
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { type: 'not_found', message: 'Session not found' }
        });
      }
      
      return reply.send({
        success: true,
        data: session,
      });
    } catch (error) {
      fastify.log.error('Error getting session:', error);
      return reply.status(500).send({
        success: false,
        error: { type: 'server_error', message: 'Failed to get session' },
      });
    }
  });
  
  // Update session (e.g., complete it)
  fastify.patch<{
    Params: { sessionId: string };
    Body: { status: string; actualDuration?: number };
  }>('/api/sessions/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const { status, actualDuration } = request.body;
      
      const updateData: any = { status };
      if (status === 'completed') {
        updateData.completedAt = new Date();
        if (actualDuration) {
          updateData.actualDuration = actualDuration;
        }
      }
      
      const updatedSession = await db.update(sessions)
        .set(updateData)
        .where((sessions, { eq }) => eq(sessions.id, sessionId))
        .returning();
      
      if (!updatedSession.length) {
        return reply.status(404).send({
          success: false,
          error: { type: 'not_found', message: 'Session not found' }
        });
      }
      
      return reply.send({
        success: true,
        data: updatedSession[0],
      });
    } catch (error) {
      fastify.log.error('Error updating session:', error);
      return reply.status(500).send({
        success: false,
        error: { type: 'server_error', message: 'Failed to update session' },
      });
    }
  });
}