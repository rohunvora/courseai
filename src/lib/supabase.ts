import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

// Only create client if we have the required config
let supabase: ReturnType<typeof createClient> | null = null;

if (config.supabase.url && config.supabase.anonKey) {
  supabase = createClient(config.supabase.url, config.supabase.anonKey);
} else {
  console.warn('Supabase configuration missing. Authentication features will be disabled.');
}

export { supabase };

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null;
};

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          topic: string;
          description?: string;
          current_level?: string;
          target_level?: string;
          timeline_weeks?: number;
          status: string;
          preferences?: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          topic: string;
          description?: string;
          current_level?: string;
          target_level?: string;
          timeline_weeks?: number;
          status?: string;
          preferences?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          topic?: string;
          description?: string;
          current_level?: string;
          target_level?: string;
          timeline_weeks?: number;
          status?: string;
          preferences?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          session_type: string;
          status: string;
          planned_duration?: number;
          actual_duration?: number;
          started_at: string;
          completed_at?: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          session_type: string;
          status?: string;
          planned_duration?: number;
          actual_duration?: number;
          started_at?: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string;
          session_type?: string;
          status?: string;
          planned_duration?: number;
          actual_duration?: number;
          started_at?: string;
          completed_at?: string;
        };
      };
      chat_history: {
        Row: {
          id: string;
          course_id: string;
          session_id?: string;
          message_type: string;
          content: string;
          context?: any;
          request_id?: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          session_id?: string;
          message_type: string;
          content: string;
          context?: any;
          request_id?: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          session_id?: string;
          message_type?: string;
          content?: string;
          context?: any;
          request_id?: string;
          timestamp?: string;
        };
      };
      progress_logs: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          session_id?: string;
          activity_type: string;
          data: any;
          metrics?: any;
          notes?: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          session_id?: string;
          activity_type: string;
          data: any;
          metrics?: any;
          notes?: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string;
          session_id?: string;
          activity_type?: string;
          data?: any;
          metrics?: any;
          notes?: string;
          timestamp?: string;
        };
      };
    };
  };
}