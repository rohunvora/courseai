import { z } from 'zod';

// API Request/Response Types
export const CreateCourseSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  currentLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  goals: z.array(z.string()).optional(),
  timelineWeeks: z.number().int().positive().optional(),
  preferences: z.object({
    sessionLength: z.number().int().positive().default(60),
    frequency: z.object({
      type: z.enum(['daily', 'weekly', 'custom', 'flexible']),
      count: z.number().optional(),
      days: z.array(z.number()).optional(),
      minPerWeek: z.number().optional(),
    }).optional(),
    difficulty: z.enum(['easy', 'moderate', 'challenging']).default('moderate'),
    focusAreas: z.array(z.string()).default([]),
  }).optional(),
});

export const ChatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().uuid().optional(),
  context: z.record(z.any()).optional(),
});

export const ProgressLogSchema = z.object({
  courseId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  activityType: z.enum(['exercise', 'quiz', 'reading', 'practice', 'reflection']),
  data: z.record(z.any()),
  notes: z.string().optional(),
});

export const StartSessionSchema = z.object({
  courseId: z.string().uuid(),
  sessionType: z.enum(['practice', 'study', 'quiz', 'review']),
  plannedDuration: z.number().int().positive().optional(),
});

// Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: Date;
  };
}

export interface ChatResponse {
  requestId: string;
  response: string;
  suggestions?: string[];
  autoLogged?: {
    id: string;
    activityType: string;
    data: Record<string, any>;
    notes?: string;
  };
  memoryUpdate?: {
    type: string;
    key: string;
    importance: number;
  };
}

export interface StreamToken {
  type: 'token' | 'suggestion' | 'complete' | 'error';
  content?: string;
  messageId?: string;
  autoLogged?: any;
  error?: string;
}

// Internal Types
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type CourseStatus = 'draft' | 'active' | 'completed' | 'paused';
export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type MessageType = 'user' | 'assistant' | 'system';

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
export type ProgressLogInput = z.infer<typeof ProgressLogSchema>;
export type StartSessionInput = z.infer<typeof StartSessionSchema>;