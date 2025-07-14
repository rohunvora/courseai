import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  createdAtIdx: index('idx_users_created_at').on(table.createdAt),
}));

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  description: text('description'),
  currentLevel: varchar('current_level', { length: 50 }),
  targetLevel: varchar('target_level', { length: 50 }),
  timelineWeeks: integer('timeline_weeks'),
  status: varchar('status', { length: 50 }).default('draft'),
  preferences: jsonb('preferences'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_courses_user_id').on(table.userId),
  statusIdx: index('idx_courses_status').on(table.status),
  topicIdx: index('idx_courses_topic').on(table.topic),
  userStatusIdx: index('idx_courses_user_status').on(table.userId, table.status),
  createdAtIdx: index('idx_courses_created_at').on(table.createdAt),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  sessionType: varchar('session_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('active'),
  plannedDuration: integer('planned_duration'),
  actualDuration: integer('actual_duration'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  userIdIdx: index('idx_sessions_user_id').on(table.userId),
  courseIdIdx: index('idx_sessions_course_id').on(table.courseId),
  startedAtIdx: index('idx_sessions_started_at').on(table.startedAt),
}));

export const chatHistory = pgTable('chat_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  messageType: varchar('message_type', { length: 20 }).notNull(),
  content: text('content').notNull(),
  context: jsonb('context'),
  requestId: varchar('request_id', { length: 50 }),
  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
  courseIdIdx: index('idx_chat_course_id').on(table.courseId),
  sessionIdIdx: index('idx_chat_session_id').on(table.sessionId),
  timestampIdx: index('idx_chat_timestamp').on(table.timestamp),
}));

export const progressLogs = pgTable('progress_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  activityType: varchar('activity_type', { length: 50 }).notNull(),
  data: jsonb('data').notNull(),
  metrics: jsonb('metrics'),
  notes: text('notes'),
  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_progress_user_id').on(table.userId),
  courseIdIdx: index('idx_progress_course_id').on(table.courseId),
  sessionIdIdx: index('idx_progress_session_id').on(table.sessionId),
  timestampIdx: index('idx_progress_timestamp').on(table.timestamp),
  userTimestampIdx: index('idx_progress_user_timestamp').on(table.userId, table.timestamp),
  activityTypeIdx: index('idx_progress_activity_type').on(table.activityType),
}));

export const curriculum = pgTable('curriculum', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  structure: jsonb('structure').notNull(),
  version: integer('version').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  courseIdIdx: index('idx_curriculum_course_id').on(table.courseId),
  versionIdx: index('idx_curriculum_version').on(table.courseId, table.version),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  sessions: many(sessions),
  progressLogs: many(progressLogs),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(users, { fields: [courses.userId], references: [users.id] }),
  sessions: many(sessions),
  chatHistory: many(chatHistory),
  progressLogs: many(progressLogs),
  curriculum: many(curriculum),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  course: one(courses, { fields: [sessions.courseId], references: [courses.id] }),
  chatHistory: many(chatHistory),
  progressLogs: many(progressLogs),
}));

export const chatHistoryRelations = relations(chatHistory, ({ one }) => ({
  course: one(courses, { fields: [chatHistory.courseId], references: [courses.id] }),
  session: one(sessions, { fields: [chatHistory.sessionId], references: [sessions.id] }),
}));

export const progressLogsRelations = relations(progressLogs, ({ one }) => ({
  user: one(users, { fields: [progressLogs.userId], references: [users.id] }),
  course: one(courses, { fields: [progressLogs.courseId], references: [courses.id] }),
  session: one(sessions, { fields: [progressLogs.sessionId], references: [sessions.id] }),
}));

export const curriculumRelations = relations(curriculum, ({ one }) => ({
  course: one(courses, { fields: [curriculum.courseId], references: [courses.id] }),
}));