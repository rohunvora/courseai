import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, progressLogs, sessions } from '../db/index.js';
import { ProgressLogSchema, StartSessionSchema } from '../types/index.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function progressRoutes(fastify: FastifyInstance) {
  // Log progress
  fastify.post<{
    Body: z.infer<typeof ProgressLogSchema>;
  }>('/api/progress/log', async (request, reply) => {
    const { courseId, sessionId, activityType, data, notes } = request.body;
    
    // For now, use a dummy user ID. In real app, extract from JWT
    const userId = '00000000-0000-0000-0000-000000000001';

    try {
      // Calculate basic metrics from data
      const metrics = calculateMetrics(activityType, data);

      const logEntry = await db.insert(progressLogs).values({
        userId,
        courseId,
        sessionId,
        activityType,
        data,
        metrics,
        notes,
      }).returning();

      // Generate summary and recommendations (simplified for now)
      const summary = generateProgressSummary(activityType, data, metrics);
      const achievements = checkAchievements(data, metrics);

      return reply.status(201).send({
        success: true,
        data: {
          id: logEntry[0].id,
          summary,
          achievements,
          nextRecommendations: generateRecommendations(activityType, data),
        },
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error logging progress:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'LOG_ERROR',
          message: 'Failed to log progress',
        },
      });
    }
  });

  // Start session
  fastify.post<{
    Body: z.infer<typeof StartSessionSchema>;
  }>('/api/sessions', async (request, reply) => {
    const { courseId, sessionType, plannedDuration } = request.body;
    
    // For now, use a dummy user ID
    const userId = '00000000-0000-0000-0000-000000000001';

    try {
      const session = await db.insert(sessions).values({
        userId,
        courseId,
        sessionType,
        plannedDuration,
        status: 'active',
      }).returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: session[0].id,
          courseId,
          sessionType,
          status: 'active',
          startedAt: session[0].startedAt,
          plannedDuration,
        },
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error starting session:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'SESSION_ERROR',
          message: 'Failed to start session',
        },
      });
    }
  });

  // Get progress for course
  fastify.get<{
    Params: { courseId: string };
    Querystring: { limit?: number; sessionId?: string };
  }>('/api/progress/:courseId', async (request, reply) => {
    const { courseId } = request.params;
    const { limit, sessionId } = request.query;

    try {
      let whereClause = eq(progressLogs.courseId, courseId);
      
      if (sessionId) {
        whereClause = eq(progressLogs.sessionId, sessionId);
      }

      const logs = await db.query.progressLogs.findMany({
        where: whereClause,
        orderBy: desc(progressLogs.timestamp),
        limit,
      });

      return reply.send({
        success: true,
        data: logs,
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching progress:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch progress',
        },
      });
    }
  });
}

// Helper functions
function calculateMetrics(activityType: string, data: any): any {
  const metrics: any = {};

  switch (activityType) {
    case 'exercise':
      if (data.weight && data.reps) {
        metrics.volume = parseFloat(data.weight) * (Array.isArray(data.reps) ? data.reps.reduce((a: number, b: number) => a + b, 0) : data.reps);
      }
      if (data.sets) {
        metrics.totalSets = data.sets;
      }
      break;
    case 'quiz':
      if (data.score && data.totalQuestions) {
        metrics.accuracy = (data.score / data.totalQuestions) * 100;
      }
      break;
    case 'reading':
      if (data.pagesRead) {
        metrics.pagesRead = data.pagesRead;
      }
      break;
  }

  return metrics;
}

function generateProgressSummary(activityType: string, data: any, metrics: any): string {
  switch (activityType) {
    case 'exercise':
      if (data.exercise && data.weight) {
        return `Completed ${data.exercise} with ${data.weight}${metrics.volume ? ` (total volume: ${metrics.volume})` : ''}`;
      }
      return `Completed ${activityType} session`;
    case 'quiz':
      if (metrics.accuracy) {
        return `Quiz completed with ${metrics.accuracy.toFixed(1)}% accuracy`;
      }
      return 'Quiz completed';
    default:
      return `${activityType} session completed`;
  }
}

function checkAchievements(data: any, metrics: any): string[] {
  const achievements: string[] = [];

  if (metrics.accuracy && metrics.accuracy >= 90) {
    achievements.push('high_score');
  }

  if (data.weight && data.previousWeight && parseFloat(data.weight) > parseFloat(data.previousWeight)) {
    achievements.push('new_pr');
  }

  return achievements;
}

function generateRecommendations(activityType: string, data: any): string {
  switch (activityType) {
    case 'exercise':
      if (data.exercise === 'bench_press') {
        return 'Try increasing weight by 5lbs next session';
      }
      return 'Keep up the good work! Focus on form.';
    case 'quiz':
      return 'Review areas where you struggled';
    default:
      return 'Continue with regular practice';
  }
}