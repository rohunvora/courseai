CREATE TABLE IF NOT EXISTS "chat_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"session_id" uuid,
	"message_type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"context" jsonb,
	"request_id" varchar(50),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"description" text,
	"current_level" varchar(50),
	"target_level" varchar(50),
	"timeline_weeks" integer,
	"status" varchar(50) DEFAULT 'draft',
	"preferences" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"structure" jsonb NOT NULL,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progress_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"session_id" uuid,
	"activity_type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"metrics" jsonb,
	"notes" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"session_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"planned_duration" integer,
	"actual_duration" integer,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"session_id" uuid,
	"tool_name" varchar(100) NOT NULL,
	"parameters" jsonb,
	"result" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error" text,
	"execution_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"content" text NOT NULL,
	"embedding" "vector(1536)",
	"embedding_model" varchar(50) DEFAULT 'text-embedding-3-small',
	"metadata" jsonb,
	"importance_score" real DEFAULT 1,
	"redacted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"timezone" varchar(50) DEFAULT 'UTC',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_course_id" ON "chat_history" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_session_id" ON "chat_history" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_timestamp" ON "chat_history" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_courses_user_id" ON "courses" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_courses_status" ON "courses" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_courses_topic" ON "courses" ("topic");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_courses_user_status" ON "courses" ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_courses_created_at" ON "courses" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_curriculum_course_id" ON "curriculum" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_curriculum_version" ON "curriculum" ("course_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_user_id" ON "progress_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_course_id" ON "progress_logs" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_session_id" ON "progress_logs" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_timestamp" ON "progress_logs" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_user_timestamp" ON "progress_logs" ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_activity_type" ON "progress_logs" ("activity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_course_id" ON "sessions" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_started_at" ON "sessions" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_calls_user_id" ON "tool_calls" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_calls_course_id" ON "tool_calls" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_calls_session_id" ON "tool_calls" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_calls_tool_name" ON "tool_calls" ("tool_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_calls_status" ON "tool_calls" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_calls_created_at" ON "tool_calls" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_user_id" ON "user_memory" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_course_id" ON "user_memory" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_redacted" ON "user_memory" ("redacted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_importance" ON "user_memory" ("importance_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_created_at" ON "users" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
