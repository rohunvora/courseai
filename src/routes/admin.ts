import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, courses, sessions, progressLogs, userMemory, chatHistory } from '../db/schema.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

interface AdminRequest {
  headers: {
    authorization?: string;
  };
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Middleware to check admin token
  const requireAdminToken = async (request: AdminRequest, reply: any) => {
    const adminToken = process.env.ADMIN_TOKEN;
    
    if (!adminToken) {
      return reply.status(500).send({
        success: false,
        error: 'Admin token not configured'
      });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);
    if (token !== adminToken) {
      return reply.status(403).send({
        success: false,
        error: 'Invalid admin token'
      });
    }
  };

  // Seed demo data endpoint
  fastify.post('/admin/seed-demo', {
    preHandler: requireAdminToken
  }, async (request, reply) => {
    try {
      // Start transaction
      const result = await db.transaction(async (tx) => {
        // Clear existing demo data
        await tx.delete(progressLogs).where(eq(progressLogs.userId, 'demo-user-1'));
        await tx.delete(progressLogs).where(eq(progressLogs.userId, 'demo-user-2'));
        await tx.delete(userMemory).where(eq(userMemory.userId, 'demo-user-1'));
        await tx.delete(userMemory).where(eq(userMemory.userId, 'demo-user-2'));
        await tx.delete(chatHistory).where(eq(chatHistory.courseId, 'demo-course-1'));
        await tx.delete(chatHistory).where(eq(chatHistory.courseId, 'demo-course-2'));
        await tx.delete(sessions).where(eq(sessions.userId, 'demo-user-1'));
        await tx.delete(sessions).where(eq(sessions.userId, 'demo-user-2'));
        await tx.delete(courses).where(eq(courses.userId, 'demo-user-1'));
        await tx.delete(courses).where(eq(courses.userId, 'demo-user-2'));
        await tx.delete(users).where(eq(users.email, 'demo@example.com'));
        await tx.delete(users).where(eq(users.email, 'test@example.com'));

        // Create demo users
        const hashedPassword = await bcrypt.hash('demo123', 10);
        const hashedTestPassword = await bcrypt.hash('test123', 10);
        
        const [demoUser] = await tx.insert(users).values({
          id: 'demo-user-1',
          email: 'demo@example.com',
          passwordHash: hashedPassword,
          firstName: 'Demo',
          lastName: 'User',
          timezone: 'America/New_York'
        }).returning();

        const [testUser] = await tx.insert(users).values({
          id: 'demo-user-2',
          email: 'test@example.com',
          passwordHash: hashedTestPassword,
          firstName: 'Test',
          lastName: 'User',
          timezone: 'America/Los_Angeles'
        }).returning();

        // Create demo courses
        const [demoCourse1] = await tx.insert(courses).values({
          id: 'demo-course-1',
          userId: demoUser.id,
          title: 'Progressive Strength Training',
          topic: 'Strength Training',
          description: 'Build strength safely with AI-guided progression',
          currentLevel: 'intermediate',
          targetLevel: 'advanced',
          timelineWeeks: 12,
          status: 'active',
          preferences: {
            focusAreas: ['upper body', 'compound movements'],
            frequency: 3,
            sessionDuration: 60,
            equipment: ['barbell', 'dumbbells', 'rack']
          }
        }).returning();

        const [demoCourse2] = await tx.insert(courses).values({
          id: 'demo-course-2',
          userId: testUser.id,
          title: 'Beginner Fitness Journey',
          topic: 'General Fitness',
          description: 'Start your fitness journey with personalized guidance',
          currentLevel: 'beginner',
          targetLevel: 'intermediate',
          timelineWeeks: 16,
          status: 'active',
          preferences: {
            focusAreas: ['full body', 'cardio'],
            frequency: 4,
            sessionDuration: 45,
            equipment: ['bodyweight', 'resistance bands']
          }
        }).returning();

        // Create demo progress logs for demo user (showing progression)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Week 1: Starting weights
        await tx.insert(progressLogs).values({
          userId: demoUser.id,
          courseId: demoCourse1.id,
          activityType: 'exercise',
          data: {
            exercise: 'Bench Press',
            sets: 3,
            reps: [8, 8, 7],
            weight: [135, 135, 135],
            unit: 'lbs',
            originalUnit: 'lbs'
          },
          metrics: {
            totalVolume: 3645,
            totalReps: 23,
            maxWeight: 135
          },
          notes: 'First workout, felt good',
          timestamp: twoWeeksAgo
        });

        await tx.insert(progressLogs).values({
          userId: demoUser.id,
          courseId: demoCourse1.id,
          activityType: 'exercise',
          data: {
            exercise: 'Squat',
            sets: 3,
            reps: [5, 5, 5],
            weight: [185, 185, 185],
            unit: 'lbs',
            originalUnit: 'lbs'
          },
          metrics: {
            totalVolume: 2775,
            totalReps: 15,
            maxWeight: 185
          },
          notes: 'Depth was good on all sets',
          timestamp: twoWeeksAgo
        });

        // Week 2: 5% progression
        await tx.insert(progressLogs).values({
          userId: demoUser.id,
          courseId: demoCourse1.id,
          activityType: 'exercise',
          data: {
            exercise: 'Bench Press',
            sets: 3,
            reps: [8, 8, 7],
            weight: [140, 140, 140],
            unit: 'lbs',
            originalUnit: 'lbs'
          },
          metrics: {
            totalVolume: 3780,
            totalReps: 23,
            maxWeight: 140
          },
          notes: 'Small increase, felt manageable',
          timestamp: oneWeekAgo
        });

        await tx.insert(progressLogs).values({
          userId: demoUser.id,
          courseId: demoCourse1.id,
          activityType: 'exercise',
          data: {
            exercise: 'Squat',
            sets: 3,
            reps: [5, 5, 5],
            weight: [195, 195, 195],
            unit: 'lbs',
            originalUnit: 'lbs'
          },
          metrics: {
            totalVolume: 2925,
            totalReps: 15,
            maxWeight: 195
          },
          notes: 'Form still solid',
          timestamp: oneWeekAgo
        });

        // Recent workout
        await tx.insert(progressLogs).values({
          userId: demoUser.id,
          courseId: demoCourse1.id,
          activityType: 'exercise',
          data: {
            exercise: 'Bench Press',
            sets: 4,
            reps: [8, 8, 7, 6],
            weight: [145, 145, 145, 145],
            unit: 'lbs',
            originalUnit: 'lbs'
          },
          metrics: {
            totalVolume: 4205,
            totalReps: 29,
            maxWeight: 145
          },
          notes: 'Added extra set, feeling stronger',
          timestamp: threeDaysAgo
        });

        // Create demo memories
        await tx.insert(userMemory).values([
          {
            userId: demoUser.id,
            courseId: demoCourse1.id,
            content: 'User prefers to warm up with 5 minutes of dynamic stretching before lifting',
            importanceScore: 0.8,
            metadata: { type: 'preference', category: 'warmup' },
            createdAt: twoWeeksAgo
          },
          {
            userId: demoUser.id,
            courseId: demoCourse1.id,
            content: 'Has a history of minor shoulder impingement, needs to be careful with overhead movements',
            importanceScore: 0.95,
            metadata: { type: 'medical', category: 'injury_history' },
            createdAt: twoWeeksAgo
          },
          {
            userId: demoUser.id,
            courseId: demoCourse1.id,
            content: 'Responds well to 3x8 rep schemes for hypertrophy work',
            importanceScore: 0.7,
            metadata: { type: 'training_response', category: 'programming' },
            createdAt: oneWeekAgo
          },
          {
            userId: testUser.id,
            courseId: demoCourse2.id,
            content: 'Complete beginner, never lifted weights before',
            importanceScore: 0.9,
            metadata: { type: 'experience', category: 'fitness_level' },
            createdAt: new Date()
          },
          {
            userId: testUser.id,
            courseId: demoCourse2.id,
            content: 'Primary goal is general health and fitness, not competitive',
            importanceScore: 0.8,
            metadata: { type: 'goal', category: 'training_goals' },
            createdAt: new Date()
          }
        ]);

        // Create active sessions
        const [demoSession] = await tx.insert(sessions).values({
          userId: demoUser.id,
          courseId: demoCourse1.id,
          sessionType: 'chat',
          status: 'active',
          plannedDuration: 60
        }).returning();

        const [testSession] = await tx.insert(sessions).values({
          userId: testUser.id,
          courseId: demoCourse2.id,
          sessionType: 'chat',
          status: 'active',
          plannedDuration: 45
        }).returning();

        // Create sample chat history
        await tx.insert(chatHistory).values([
          {
            courseId: demoCourse1.id,
            sessionId: demoSession.id,
            messageType: 'user',
            content: 'I completed my bench press workout today! Hit 145 for 8,8,7,6 reps',
            timestamp: threeDaysAgo
          },
          {
            courseId: demoCourse1.id,
            sessionId: demoSession.id,
            messageType: 'assistant',
            content: 'Great job on your bench press session! I see you hit 145 lbs for a total of 29 reps across 4 sets. That\'s solid progress from your previous workout at 140 lbs. The progression is within the safe 10% increase range. How did the weight feel? Any discomfort in your shoulders?',
            timestamp: threeDaysAgo
          }
        ]);

        return {
          users: [demoUser, testUser],
          courses: [demoCourse1, demoCourse2],
          sessions: [demoSession, testSession],
          progressLogsCount: 5,
          memoriesCount: 5
        };
      });

      // Log the seeding action
      fastify.log.info({
        action: 'admin_seed_demo',
        timestamp: new Date().toISOString(),
        result: {
          usersCreated: result.users.length,
          coursesCreated: result.courses.length,
          sessionsCreated: result.sessions.length,
          progressLogsCreated: result.progressLogsCount,
          memoriesCreated: result.memoriesCount
        }
      });

      return reply.send({
        success: true,
        message: 'Demo data seeded successfully',
        data: {
          users: result.users.map(u => ({
            email: u.email,
            password: u.email === 'demo@example.com' ? 'demo123' : 'test123',
            name: `${u.firstName} ${u.lastName}`
          })),
          courses: result.courses.map(c => ({
            id: c.id,
            title: c.title,
            userId: c.userId
          })),
          stats: {
            progressLogs: result.progressLogsCount,
            memories: result.memoriesCount,
            sessions: result.sessions.length
          }
        }
      });

    } catch (error) {
      fastify.log.error({
        action: 'admin_seed_demo_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to seed demo data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoint for admin monitoring
  fastify.get('/admin/health', {
    preHandler: requireAdminToken
  }, async (request, reply) => {
    try {
      // Test database connection
      const dbTest = await db.select({ count: users.id }).from(users);
      
      return reply.send({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        features: {
          previewMode: process.env.ENABLE_PREVIEW_FEATURES === 'true',
          adminToken: !!process.env.ADMIN_TOKEN
        },
        database: {
          connected: true,
          userCount: dbTest.length
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clear all data endpoint (dangerous - extra confirmation required)
  fastify.delete('/admin/clear-all', {
    preHandler: requireAdminToken
  }, async (request: any, reply) => {
    // Require additional confirmation
    if (request.body?.confirm !== 'DELETE_ALL_DATA') {
      return reply.status(400).send({
        success: false,
        error: 'Missing confirmation. Send { "confirm": "DELETE_ALL_DATA" } in body.'
      });
    }

    try {
      await db.transaction(async (tx) => {
        // Clear in correct order due to foreign keys
        await tx.delete(progressLogs);
        await tx.delete(userMemory);
        await tx.delete(chatHistory);
        await tx.delete(sessions);
        await tx.delete(courses);
        await tx.delete(users);
      });

      fastify.log.warn({
        action: 'admin_clear_all_data',
        timestamp: new Date().toISOString()
      });

      return reply.send({
        success: true,
        message: 'All data cleared successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to clear data'
      });
    }
  });
}