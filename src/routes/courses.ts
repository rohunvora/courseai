import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, courses, curriculum } from '../db/index.js';
import { OpenAIService } from '../services/openai.js';
import { CreateCourseSchema } from '../types/index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

let openai: OpenAIService;

export async function courseRoutes(fastify: FastifyInstance) {
  // Create course
  fastify.post<{
    Body: z.infer<typeof CreateCourseSchema>;
  }>('/api/courses', async (request, reply) => {
    const { topic, currentLevel, goals, timelineWeeks, preferences } = request.body;
    
    // For now, use a dummy user ID. In real app, extract from JWT
    const userId = '00000000-0000-0000-0000-000000000001';

    try {
      // Create course
      const newCourse = await db.insert(courses).values({
        userId,
        title: `${topic} Course`,
        topic,
        currentLevel,
        timelineWeeks: timelineWeeks || 8,
        status: 'draft',
        preferences,
      }).returning();

      const courseId = newCourse[0].id;

      return reply.status(201).send({
        success: true,
        data: {
          id: courseId,
          topic,
          status: 'draft',
          createdAt: newCourse[0].createdAt,
        },
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error creating course:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create course',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  // Generate curriculum (stub for now)
  fastify.post<{
    Body: {
      courseId: string;
      regenerate?: boolean;
    };
  }>('/api/curriculum/generate', async (request, reply) => {
    const { courseId, regenerate } = request.body;

    try {
      // Get course details
      const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId),
      });

      if (!course) {
        return reply.status(404).send({ error: 'Course not found' });
      }

      // Check if curriculum already exists
      const existingCurriculum = await db.query.curriculum.findFirst({
        where: eq(curriculum.courseId, courseId),
      });

      if (existingCurriculum && !regenerate) {
        return reply.send({
          success: true,
          data: {
            courseId,
            curriculum: existingCurriculum.structure,
            version: existingCurriculum.version,
            status: 'existing',
          },
        });
      }

      // Initialize OpenAI service if not already done
      if (!openai) {
        openai = new OpenAIService();
      }

      // Generate new curriculum
      const outline = await openai.generateCourseOutline(
        course.topic,
        course.currentLevel || 'beginner',
        course.preferences?.focusAreas
      );

      // Save curriculum
      const newCurriculum = await db.insert(curriculum).values({
        courseId,
        structure: outline,
        version: existingCurriculum ? (existingCurriculum.version || 1) + 1 : 1,
      }).returning();

      // Update course status to active
      await db.update(courses)
        .set({ status: 'active' })
        .where(eq(courses.id, courseId));

      return reply.send({
        success: true,
        data: {
          courseId,
          curriculum: outline,
          version: newCurriculum[0].version,
          status: 'generated',
        },
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error generating curriculum:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'GENERATION_ERROR',
          message: 'Failed to generate curriculum',
        },
      });
    }
  });

  // Get course details
  fastify.get<{
    Params: { courseId: string };
  }>('/api/courses/:courseId', async (request, reply) => {
    const { courseId } = request.params;

    try {
      const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId),
        with: {
          curriculum: true,
        },
      });

      if (!course) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Course not found',
          },
        });
      }

      return reply.send({
        success: true,
        data: course,
        meta: {
          requestId: uuidv4(),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error fetching course:', error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch course',
        },
      });
    }
  });
}