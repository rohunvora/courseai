import { db } from '../db';
import { progressLogs, toolCalls, courses } from '../db/schema';
import { OpenAI } from 'openai';
import { eq, and, gte } from 'drizzle-orm';

export interface WorkoutLog {
  exercise: string;
  sets: number;
  reps: number[];
  weight?: number[];
  unit?: 'kg' | 'lbs';
  duration?: string;
  notes?: string;
}

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'log_workout',
      description: 'Log a workout activity with sets, reps, and weights',
      parameters: {
        type: 'object',
        properties: {
          exercise: {
            type: 'string',
            description: 'The name of the exercise (e.g., "bench press", "squats")',
          },
          sets: {
            type: 'number',
            description: 'Number of sets performed',
          },
          reps: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of reps for each set',
          },
          weight: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of weights for each set (optional)',
          },
          unit: {
            type: 'string',
            enum: ['kg', 'lbs'],
            description: 'Unit of weight (kg or lbs)',
          },
          duration: {
            type: 'string',
            description: 'Duration of the exercise if applicable',
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the workout',
          },
        },
        required: ['exercise', 'sets', 'reps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_progress',
      description: 'Update or correct a previous workout log entry',
      parameters: {
        type: 'object',
        properties: {
          logId: {
            type: 'string',
            description: 'The ID of the progress log to update',
          },
          updates: {
            type: 'object',
            description: 'Fields to update',
            properties: {
              exercise: { type: 'string' },
              sets: { type: 'number' },
              reps: { type: 'array', items: { type: 'number' } },
              weight: { type: 'array', items: { type: 'number' } },
              unit: { type: 'string', enum: ['kg', 'lbs'] },
              notes: { type: 'string' },
            },
          },
        },
        required: ['logId', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_progress_summary',
      description: 'Get a summary of progress for specific exercises or time periods',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            description: 'What to summarize: "exercise", "volume", "frequency", or "personal_records"',
            enum: ['exercise', 'volume', 'frequency', 'personal_records'],
          },
          exercise: {
            type: 'string',
            description: 'Specific exercise to get summary for (optional)',
          },
          timeframe: {
            type: 'string',
            description: 'Time period: "week", "month", "all_time"',
            enum: ['week', 'month', 'all_time'],
          },
        },
        required: ['metric', 'timeframe'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_course_goal',
      description: 'Modify course goals, timeline, or preferences',
      parameters: {
        type: 'object',
        properties: {
          courseId: {
            type: 'string',
            description: 'The ID of the course to update',
          },
          updates: {
            type: 'object',
            description: 'Course fields to update',
            properties: {
              title: { type: 'string' },
              targetLevel: { type: 'string' },
              timelineWeeks: { type: 'number' },
              preferences: {
                type: 'object',
                properties: {
                  focusAreas: { type: 'array', items: { type: 'string' } },
                  frequency: { type: 'number' },
                  sessionDuration: { type: 'number' },
                },
              },
            },
          },
        },
        required: ['courseId', 'updates'],
      },
    },
  },
];

export async function executeLogWorkout(
  params: WorkoutLog,
  context: {
    userId: string;
    courseId: string;
    sessionId?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    if (!params.exercise || !params.sets || !params.reps) {
      throw new Error('Missing required parameters: exercise, sets, and reps are required');
    }

    if (params.reps.length !== params.sets) {
      throw new Error(`Reps array length (${params.reps.length}) must match number of sets (${params.sets})`);
    }

    if (params.weight && params.weight.length !== params.sets) {
      throw new Error(`Weight array length (${params.weight.length}) must match number of sets (${params.sets})`);
    }

    // Create progress log entry
    const [result] = await db
      .insert(progressLogs)
      .values({
        userId: context.userId,
        courseId: context.courseId,
        sessionId: context.sessionId,
        activityType: 'exercise',
        data: {
          exercise: params.exercise,
          sets: params.sets,
          reps: params.reps,
          weight: params.weight,
          unit: params.unit || 'lbs',
          duration: params.duration,
        },
        metrics: {
          totalVolume: params.weight
            ? params.weight.reduce((acc, w, i) => acc + w * params.reps[i], 0)
            : null,
          totalReps: params.reps.reduce((acc, r) => acc + r, 0),
          maxWeight: params.weight ? Math.max(...params.weight) : null,
        },
        notes: params.notes,
      })
      .returning({ id: progressLogs.id });

    // Log the tool call
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'log_workout',
      parameters: params,
      result: { success: true, id: result.id },
      status: 'success',
      executionTime: Date.now() - startTime,
    });

    return { success: true, id: result.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log the failed tool call
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'log_workout',
      parameters: params,
      result: { success: false, error: errorMessage },
      status: 'failed',
      error: errorMessage,
      executionTime: Date.now() - startTime,
    });

    return { success: false, error: errorMessage };
  }
}

export async function executeUpdateProgress(
  params: { logId: string; updates: any },
  context: { userId: string; courseId: string; sessionId?: string }
): Promise<{ success: boolean; updated?: any; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Get the existing log to verify ownership
    const [existingLog] = await db
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.id, params.logId),
          eq(progressLogs.userId, context.userId)
        )
      )
      .limit(1);

    if (!existingLog) {
      throw new Error('Progress log not found or access denied');
    }

    // Merge updates with existing data
    const updatedData = { ...(existingLog.data as any), ...params.updates };
    
    // Recalculate metrics if weights or reps changed
    let updatedMetrics = existingLog.metrics;
    if (params.updates.weight || params.updates.reps) {
      const weight = updatedData.weight || [];
      const reps = updatedData.reps || [];
      updatedMetrics = {
        totalVolume: weight.length > 0
          ? weight.reduce((acc: number, w: number, i: number) => acc + w * (reps[i] || 0), 0)
          : null,
        totalReps: reps.reduce((acc: number, r: number) => acc + r, 0),
        maxWeight: weight.length > 0 ? Math.max(...weight) : null,
      };
    }

    // Update the log
    const [updated] = await db
      .update(progressLogs)
      .set({
        data: updatedData,
        metrics: updatedMetrics,
        notes: params.updates.notes || existingLog.notes,
      })
      .where(eq(progressLogs.id, params.logId))
      .returning();

    // Log the tool call
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'update_progress',
      parameters: params,
      result: { success: true, updated },
      status: 'success',
      executionTime: Date.now() - startTime,
    });

    return { success: true, updated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'update_progress',
      parameters: params,
      result: { success: false, error: errorMessage },
      status: 'failed',
      error: errorMessage,
      executionTime: Date.now() - startTime,
    });

    return { success: false, error: errorMessage };
  }
}

export async function executeGetProgressSummary(
  params: { metric: string; exercise?: string; timeframe: string },
  context: { userId: string; courseId: string; sessionId?: string }
): Promise<{ success: boolean; summary?: any; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (params.timeframe) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all_time':
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Base query
    let query = db
      .select()
      .from(progressLogs)
      .where(
        and(
          eq(progressLogs.userId, context.userId),
          eq(progressLogs.courseId, context.courseId),
          eq(progressLogs.activityType, 'exercise'),
          gte(progressLogs.timestamp, startDate)
        )
      );

    const logs = await query;
    
    let summary: any = {};
    
    switch (params.metric) {
      case 'exercise':
        // Summary for specific exercise
        const exerciseLogs = params.exercise
          ? logs.filter(log => (log.data as any).exercise?.toLowerCase() === params.exercise?.toLowerCase())
          : logs;
          
        summary = {
          totalSessions: exerciseLogs.length,
          totalVolume: exerciseLogs.reduce((acc, log) => acc + ((log.metrics as any)?.totalVolume || 0), 0),
          totalReps: exerciseLogs.reduce((acc, log) => acc + ((log.metrics as any)?.totalReps || 0), 0),
          exercises: [...new Set(exerciseLogs.map(log => (log.data as any).exercise))],
        };
        break;
        
      case 'volume':
        // Total volume across all exercises
        summary = {
          totalVolume: logs.reduce((acc, log) => acc + ((log.metrics as any)?.totalVolume || 0), 0),
          byExercise: logs.reduce((acc, log) => {
            const exercise = (log.data as any).exercise;
            const volume = (log.metrics as any)?.totalVolume || 0;
            acc[exercise] = (acc[exercise] || 0) + volume;
            return acc;
          }, {} as Record<string, number>),
        };
        break;
        
      case 'frequency':
        // Workout frequency
        const daysWithWorkouts = new Set(logs.map(log => 
          log.timestamp?.toISOString().split('T')[0]
        )).size;
        
        summary = {
          totalWorkouts: logs.length,
          daysActive: daysWithWorkouts,
          averagePerWeek: params.timeframe === 'week' ? logs.length : 
                         params.timeframe === 'month' ? (logs.length / 4.3) : 0,
        };
        break;
        
      case 'personal_records':
        // Find max weights per exercise
        summary = {
          records: logs.reduce((acc, log) => {
            const exercise = (log.data as any).exercise;
            const maxWeight = (log.metrics as any)?.maxWeight || 0;
            if (!acc[exercise] || acc[exercise] < maxWeight) {
              acc[exercise] = maxWeight;
            }
            return acc;
          }, {} as Record<string, number>),
        };
        break;
    }

    // Log the tool call
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'get_progress_summary',
      parameters: params,
      result: { success: true, summary },
      status: 'success',
      executionTime: Date.now() - startTime,
    });

    return { success: true, summary };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'get_progress_summary',
      parameters: params,
      result: { success: false, error: errorMessage },
      status: 'failed',
      error: errorMessage,
      executionTime: Date.now() - startTime,
    });

    return { success: false, error: errorMessage };
  }
}

export async function executeUpdateCourseGoal(
  params: { courseId: string; updates: any },
  context: { userId: string; courseId: string; sessionId?: string }
): Promise<{ success: boolean; updated?: any; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Verify course ownership
    const [existingCourse] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, params.courseId),
          eq(courses.userId, context.userId)
        )
      )
      .limit(1);

    if (!existingCourse) {
      throw new Error('Course not found or access denied');
    }

    // Prepare update object
    const updateData: any = {};
    
    if (params.updates.title) updateData.title = params.updates.title;
    if (params.updates.targetLevel) updateData.targetLevel = params.updates.targetLevel;
    if (params.updates.timelineWeeks) updateData.timelineWeeks = params.updates.timelineWeeks;
    if (params.updates.preferences) {
      updateData.preferences = {
        ...(existingCourse.preferences as any),
        ...params.updates.preferences,
      };
    }
    
    updateData.updatedAt = new Date();

    // Update the course
    const [updated] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, params.courseId))
      .returning();

    // Log the tool call
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'update_course_goal',
      parameters: params,
      result: { success: true, updated },
      status: 'success',
      executionTime: Date.now() - startTime,
    });

    return { success: true, updated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await db.insert(toolCalls).values({
      userId: context.userId,
      courseId: context.courseId,
      sessionId: context.sessionId,
      toolName: 'update_course_goal',
      parameters: params,
      result: { success: false, error: errorMessage },
      status: 'failed',
      error: errorMessage,
      executionTime: Date.now() - startTime,
    });

    return { success: false, error: errorMessage };
  }
}

export async function executeTool(
  toolName: string,
  parameters: any,
  context: {
    userId: string;
    courseId: string;
    sessionId?: string;
  }
): Promise<any> {
  switch (toolName) {
    case 'log_workout':
      return executeLogWorkout(parameters, context);
    case 'update_progress':
      return executeUpdateProgress(parameters, context);
    case 'get_progress_summary':
      return executeGetProgressSummary(parameters, context);
    case 'update_course_goal':
      return executeUpdateCourseGoal(parameters, context);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}