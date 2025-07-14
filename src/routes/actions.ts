import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actionLogger } from '../middleware/actionLogger';

const ActionTrackSchema = z.object({
  timestamp: z.string(),
  action: z.string(),
  details: z.any(),
  url: z.string(),
  userAgent: z.string(),
});

export async function actionRoutes(fastify: FastifyInstance) {
  // Track frontend actions
  fastify.post<{
    Body: z.infer<typeof ActionTrackSchema>;
  }>('/actions/track', async (request, reply) => {
    try {
      const validation = ActionTrackSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: { type: 'validation_error', message: 'Invalid action data' }
        });
      }
      
      const { action, details, url, userAgent } = validation.data;
      
      // Log the frontend action
      actionLogger.logAction(`frontend_${action}`, {
        ...details,
        url,
        userAgent,
        ip: request.ip,
      }, request);
      
      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Error tracking action:', error);
      return reply.status(500).send({
        success: false,
        error: { type: 'server_error', message: 'Failed to track action' },
      });
    }
  });
  
  // Get recent actions for debugging
  fastify.get('/actions/recent', async (request, reply) => {
    try {
      const actions = actionLogger.getRecentActions(50);
      return reply.send({
        success: true,
        actions,
        total: actions.length,
      });
    } catch (error) {
      fastify.log.error('Error getting recent actions:', error);
      return reply.status(500).send({
        success: false,
        error: { type: 'server_error', message: 'Failed to get actions' },
      });
    }
  });
  
  // Get actions by session
  fastify.get<{
    Querystring: { sessionId: string };
  }>('/actions/session/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const actions = actionLogger.getActionsBySession(sessionId);
      return reply.send({
        success: true,
        actions,
        total: actions.length,
        sessionId,
      });
    } catch (error) {
      fastify.log.error('Error getting session actions:', error);
      return reply.status(500).send({
        success: false,
        error: { type: 'server_error', message: 'Failed to get session actions' },
      });
    }
  });
  
  // Clear actions (for debugging)
  fastify.delete('/actions/clear', async (request, reply) => {
    try {
      actionLogger.clearActions();
      console.log('\n🧹 ACTIONS CLEARED\n');
      return reply.send({ success: true, message: 'Actions cleared' });
    } catch (error) {
      fastify.log.error('Error clearing actions:', error);
      return reply.status(500).send({
        success: false,
        error: { type: 'server_error', message: 'Failed to clear actions' },
      });
    }
  });
}