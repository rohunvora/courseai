import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { progressLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const RecentLogsQuerySchema = z.object({
  courseId: z.string(),
  limit: z.string().optional().default('10'),
});

export async function progressRoutes(fastify: FastifyInstance) {
  // Get recent progress logs for a course
  fastify.get<{
    Querystring: z.infer<typeof RecentLogsQuerySchema>;
  }>('/progress/recent', async (request, reply) => {
    try {
      const validation = RecentLogsQuerySchema.safeParse(request.query);
      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: { type: 'validation_error', message: validation.error.issues[0].message }
        });
      }
      
      const { courseId, limit } = validation.data;
      const limitNum = parseInt(limit, 10);
      
      if (limitNum < 1 || limitNum > 50) {
        return reply.status(400).send({
          success: false,
          error: { type: 'validation_error', message: 'Limit must be between 1 and 50' }
        });
      }
      
      // Fetch recent progress logs for the course
      const logs = await db
        .select({
          id: progressLogs.id,
          activityType: progressLogs.activityType,
          data: progressLogs.data,
          timestamp: progressLogs.timestamp,
        })
        .from(progressLogs)
        .where(eq(progressLogs.courseId, courseId))
        .orderBy(desc(progressLogs.timestamp))
        .limit(limitNum);
        
      return reply.send({
        success: true,
        logs: logs.map(log => ({
          id: log.id,
          activityType: log.activityType || 'activity',
          data: log.data || {},
          timestamp: log.timestamp?.toISOString() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      fastify.log.error('Error fetching recent progress logs:', error);
      return reply.status(500).send({
        success: false,
        error: {
          type: 'server_error',
          message: 'Failed to fetch recent progress logs',
        },
      });
    }
  });
}