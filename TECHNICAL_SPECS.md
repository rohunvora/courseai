# Courses AI - Technical Specifications

## API Design

### Core Endpoints

#### Authentication
```
POST /auth/register
POST /auth/login
POST /auth/refresh
DELETE /auth/logout
```

#### User Management
```
GET    /api/users/profile
PUT    /api/users/profile
GET    /api/users/preferences
PUT    /api/users/preferences
```

#### Course Management
```
POST   /api/courses                    # Create new course
GET    /api/courses                    # List user's courses (with pagination & filters)
GET    /api/courses/{id}               # Get course details
PATCH  /api/courses/{id}               # Partial update course
DELETE /api/courses/{id}               # Delete course
POST   /api/courses/{id}/complete      # Mark course complete
```

#### Session Management
```
POST   /api/sessions                   # Start new learning session
GET    /api/sessions/{id}              # Get session details
PATCH  /api/sessions/{id}              # Update session progress
POST   /api/sessions/{id}/complete     # End session
GET    /api/courses/{id}/sessions      # List course sessions
```

#### Curriculum Builder
```
POST   /api/curriculum/generate        # Generate course outline
PUT    /api/curriculum/{course_id}     # Update curriculum
GET    /api/curriculum/{course_id}     # Get curriculum structure
```

#### Chat & Memory
```
POST   /api/chat/{course_id}/message   # Send message in course context
GET    /api/chat/{course_id}/stream    # Stream chat responses (SSE)
GET    /api/chat/{course_id}/history   # Get conversation history
POST   /api/memory/store               # Store user context/memory
GET    /api/memory/retrieve            # Retrieve relevant memories
```

#### Progress Tracking
```
POST   /api/progress/log               # Log activity/achievement
GET    /api/progress/{course_id}       # Get course progress (with filters)
GET    /api/progress/analytics         # Get user analytics & gamification
PATCH  /api/progress/{id}              # Update progress entry
GET    /api/analytics/streaks          # Get streak data
GET    /api/analytics/achievements     # Get achievements & badges
```

#### Content & Resources
```
POST   /api/content/upload             # Upload user content
GET    /api/content/{course_id}        # Get course content
POST   /api/integrations/import        # Import external content
```

### Query Parameters & Pagination

#### List Courses with Filters
```http
GET /api/courses?page=1&limit=10&status=active&topic=fitness&sort=created_at:desc

Response: 200 OK
{
  "data": [...courses],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 47,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "status": "active",
      "topic": "fitness"
    }
  }
}
```

#### Session Management
```http
POST /api/sessions
Content-Type: application/json

{
  "courseId": "course_123",
  "sessionType": "practice",
  "plannedDuration": 60
}

Response: 201 Created
{
  "id": "session_abc",
  "courseId": "course_123",
  "status": "active",
  "startedAt": "2024-01-15T10:00:00Z",
  "plannedDuration": 60
}
```

### Request/Response Examples

#### Create Course
```http
POST /api/courses
Content-Type: application/json

{
  "topic": "Strength Training for Beginners",
  "current_level": "beginner",
  "goals": ["build muscle", "improve form"],
  "timeline": "3 months",
  "preferences": {
    "session_length": 60,
    "frequency": "3x per week"
  }
}

Response: 201 Created
{
  "id": "course_123",
  "topic": "Strength Training for Beginners",
  "status": "generating",
  "created_at": "2024-01-15T10:00:00Z"
}
```

#### Chat Message with Auto-Logging
```http
POST /api/chat/course_123/message
Content-Type: application/json
X-Request-ID: req_xyz789

{
  "message": "I felt my back pull during shoulder press, is that normal?",
  "sessionId": "session_abc",
  "context": {
    "current_exercise": "shoulder_press",
    "weight": "25lbs",
    "reps_completed": 5
  }
}

Response: 200 OK
{
  "requestId": "req_xyz789",
  "response": "No, you shouldn't feel strain in your back during shoulder press. This suggests your core isn't engaged or you're arching your back. Try...",
  "suggestions": ["engage core", "lighter weight", "check form video"],
  "autoLogged": {
    "id": "progress_789",
    "exercise": "shoulder_press",
    "weight": "25lbs",
    "reps": 5,
    "notes": "form correction needed",
    "needsAttention": true
  },
  "memoryUpdate": {
    "type": "struggle",
    "key": "shoulder_press_form",
    "importance": 0.8
  }
}
```

#### Streaming Chat Response
```http
GET /api/chat/course_123/stream?after=msg_456&session_id=session_abc
Accept: text/event-stream

Response: 200 OK
Content-Type: text/event-stream

data: {"type": "token", "content": "No,", "messageId": "msg_789"}

data: {"type": "token", "content": " you", "messageId": "msg_789"}

data: {"type": "suggestion", "content": "engage core", "messageId": "msg_789"}

data: {"type": "complete", "messageId": "msg_789", "autoLogged": {...}}
```

#### Log Progress
```http
POST /api/progress/log
Content-Type: application/json

{
  "course_id": "course_123",
  "activity_type": "exercise",
  "data": {
    "exercise": "bench_press",
    "weight": "135lbs",
    "sets": 3,
    "reps": [8, 7, 6],
    "notes": "felt strong today"
  },
  "timestamp": "2024-01-15T11:30:00Z"
}

Response: 201 Created
{
  "id": "progress_456",
  "summary": "Personal record! Up 10lbs from last session.",
  "achievements": ["new_pr"],
  "next_recommendations": "Try 140lbs next session"
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### Courses Table
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  description TEXT,
  current_level VARCHAR(50), -- beginner, intermediate, advanced
  target_level VARCHAR(50),
  timeline_weeks INTEGER,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed, paused
  preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_topic ON courses(topic);
CREATE INDEX idx_courses_user_status ON courses(user_id, status);
CREATE INDEX idx_courses_created_at ON courses(created_at);
```

### Curriculum Table
```sql
CREATE TABLE curriculum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  structure JSONB NOT NULL, -- Full curriculum tree
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Modules Table
```sql
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  module_type VARCHAR(50), -- lesson, practice, quiz, milestone
  content JSONB,
  prerequisites JSONB, -- Array of module IDs
  estimated_duration INTEGER, -- minutes
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Chat History Table
```sql
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  context JSONB, -- Additional context/metadata
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### User Memory Table
```sql
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  memory_type VARCHAR(50), -- preference, achievement, fact, goal, struggle, success
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  context VARCHAR(255), -- course_id or global
  importance_score FLOAT DEFAULT 1.0,
  embedding VECTOR(1536), -- OpenAI ada-002 embeddings for semantic search
  last_accessed TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_memory_user_id ON user_memory(user_id);
CREATE INDEX idx_memory_type ON user_memory(memory_type);
CREATE INDEX idx_memory_context ON user_memory(context);
CREATE INDEX idx_memory_importance ON user_memory(importance_score);
CREATE INDEX idx_memory_key ON user_memory(key);
-- Vector similarity search (requires pgvector extension)
CREATE INDEX idx_memory_embedding ON user_memory USING ivfflat(embedding vector_cosine_ops);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL, -- practice, study, quiz, review
  status VARCHAR(20) DEFAULT 'active', -- active, completed, abandoned
  planned_duration INTEGER, -- minutes
  actual_duration INTEGER, -- minutes
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_course_id ON sessions(course_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
```

### Progress Logs Table
```sql
CREATE TABLE progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL, -- exercise, quiz, reading, practice
  data JSONB NOT NULL,
  metrics JSONB, -- Calculated metrics (reps, score, time, etc.)
  notes TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_progress_user_id ON progress_logs(user_id);
CREATE INDEX idx_progress_course_id ON progress_logs(course_id);
CREATE INDEX idx_progress_session_id ON progress_logs(session_id);
CREATE INDEX idx_progress_timestamp ON progress_logs(timestamp);
CREATE INDEX idx_progress_user_timestamp ON progress_logs(user_id, timestamp);
CREATE INDEX idx_progress_activity_type ON progress_logs(activity_type);
-- GIN indexes for JSONB queries
CREATE INDEX idx_progress_data_gin ON progress_logs USING GIN(data);
CREATE INDEX idx_progress_metrics_gin ON progress_logs USING GIN(metrics);
```

### Analytics Table
```sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- streak, pr, completion_rate, etc.
  metric_value FLOAT NOT NULL,
  period VARCHAR(20), -- daily, weekly, monthly, all_time
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

## Data Models & Interfaces

### Core Types (TypeScript)

```typescript
// User & Authentication
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  timezone: string;
  preferences: UserPreferences;
  createdAt: Date;
}

interface UserPreferences {
  defaultSessionLength: number;
  reminderSettings: ReminderSettings;
  privacySettings: PrivacySettings;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
}

// Course Structure
interface Course {
  id: string;
  userId: string;
  title: string;
  topic: string;
  description?: string;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  timelineWeeks: number;
  status: CourseStatus;
  preferences: CoursePreferences;
  createdAt: Date;
  updatedAt: Date;
}

type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type CourseStatus = 'draft' | 'active' | 'completed' | 'paused';

interface CoursePreferences {
  sessionLength: number; // minutes
  frequency: FrequencyPattern;
  difficulty: 'easy' | 'moderate' | 'challenging';
  focusAreas: string[];
}

type FrequencyPattern = 
  | { type: 'daily' }
  | { type: 'weekly', count: number } // e.g., 3x per week
  | { type: 'custom', days: number[] } // days of week (0=Sunday)
  | { type: 'flexible', minPerWeek: number };

// Curriculum & Modules
interface Curriculum {
  id: string;
  courseId: string;
  structure: CurriculumNode[];
  version: number;
  createdAt: Date;
}

interface CurriculumNode {
  id: string;
  title: string;
  type: 'section' | 'module' | 'lesson' | 'practice' | 'quiz';
  children?: CurriculumNode[];
  estimatedDuration: number;
  prerequisites: string[];
  learningObjectives: string[];
  depth: number; // tree depth for O(1) queries
  path: string; // dot-separated path like "1.2.3"
}

interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  orderIndex: number;
  moduleType: ModuleType;
  content: ModuleContent;
  prerequisites: string[];
  estimatedDuration: number;
}

type ModuleType = 'lesson' | 'practice' | 'quiz' | 'milestone' | 'reflection';

interface ModuleContent {
  instructions?: string;
  materials?: Resource[];
  exercises?: Exercise[];
  quiz?: Quiz;
  interactiveElements?: InteractiveElement[];
}

// Progress & Analytics
interface ProgressLog {
  id: string;
  userId: string;
  courseId: string;
  moduleId?: string;
  activityType: ActivityType;
  data: Record<string, any>;
  metrics: ProgressMetrics;
  notes?: string;
  timestamp: Date;
}

type ActivityType = 'exercise' | 'quiz' | 'reading' | 'practice' | 'reflection';

interface ProgressMetrics {
  score?: number;
  duration?: number;
  accuracy?: number;
  difficulty?: number;
  completion?: number;
  personalRecord?: boolean;
}

interface Analytics {
  streaks: StreakData;
  achievements: Achievement[];
  progressTrends: TrendData[];
  performance: PerformanceMetrics;
}

// Chat & Memory
interface ChatMessage {
  id: string;
  courseId: string;
  sessionId?: string;
  messageType: 'user' | 'assistant' | 'system';
  content: string;
  context?: Record<string, any>;
  requestId?: string; // for idempotency and retry handling
  timestamp: Date;
}

interface UserMemory {
  id: string;
  userId: string;
  memoryType: MemoryType;
  key: string;
  value: any;
  context?: string;
  importanceScore: number;
  lastAccessed: Date;
}

type MemoryType = 'preference' | 'achievement' | 'fact' | 'goal' | 'struggle' | 'success';
```

### API Response Types

```typescript
// Standard API Response Wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: PaginationInfo;
    requestId: string;
    timestamp: Date;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Specific Response Types
interface CourseGenerationResponse {
  courseId: string;
  status: 'generating' | 'ready' | 'error';
  estimatedCompletion?: Date;
  preview?: {
    outline: string[];
    estimatedDuration: number;
    moduleCount: number;
  };
}

interface ChatResponse {
  requestId: string;
  response: string;
  suggestions?: string[];
  autoLogged?: ProgressLog;
  memoryUpdate?: Partial<UserMemory>;
  nextAction?: {
    type: string;
    prompt: string;
  };
  retryable?: boolean; // indicates if request can be safely retried
}
```

## Integration Requirements

### LLM Integration (OpenAI GPT-4)

```typescript
interface LLMService {
  generateCourse(prompt: CourseGenerationPrompt): Promise<Curriculum>;
  chatResponse(message: string, context: ChatContext): Promise<ChatResponse>;
  analyzeProgress(logs: ProgressLog[]): Promise<ProgressAnalysis>;
  adaptCurriculum(current: Curriculum, performance: PerformanceData): Promise<Curriculum>;
}

interface CourseGenerationPrompt {
  topic: string;
  currentLevel: SkillLevel;
  goals: string[];
  constraints: {
    timeAvailable: number;
    resources: string[];
    preferences: CoursePreferences;
  };
  userHistory?: ProgressLog[];
}

interface ChatContext {
  courseId: string;
  currentModule?: Module;
  recentActivity?: ProgressLog[];
  userMemory: UserMemory[];
  conversationHistory: ChatMessage[];
}
```

### Memory Storage (Vector Database)

```typescript
interface MemoryService {
  store(memory: UserMemory): Promise<void>;
  retrieve(query: string, userId: string, limit?: number): Promise<UserMemory[]>;
  update(memoryId: string, updates: Partial<UserMemory>): Promise<void>;
  search(criteria: MemorySearchCriteria): Promise<UserMemory[]>;
}

interface MemorySearchCriteria {
  userId: string;
  memoryTypes?: MemoryType[];
  context?: string;
  minImportance?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}
```

### External Content Integration

```typescript
interface ContentService {
  importContent(source: ContentSource): Promise<Resource[]>;
  enrichCurriculum(curriculum: Curriculum): Promise<Curriculum>;
  validateResources(resources: Resource[]): Promise<ValidationResult[]>;
}

interface ContentSource {
  type: 'youtube' | 'article' | 'book' | 'pdf' | 'api';
  url?: string;
  metadata?: Record<string, any>;
  accessConfig?: {
    apiKey?: string;
    headers?: Record<string, string>;
  };
}

interface Resource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'exercise' | 'quiz' | 'document';
  url?: string;
  content?: string;
  metadata: {
    duration?: number;
    difficulty?: SkillLevel;
    tags: string[];
    source: string;
  };
}
```

## Authentication & Security

### JWT Token Structure
```typescript
interface JWTPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
  scope: string[];
}
```

### Security Requirements
- All API endpoints require authentication except auth routes
- Rate limiting: 100 requests/minute per user
- Input validation and sanitization on all endpoints
- CORS configuration for frontend domains
- Encrypted storage for sensitive user data
- Regular security audits for LLM prompt injection

## Operational Considerations

### Retry Logic & Error Handling
```typescript
interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  retryableErrors: string[]; // error codes that can be retried
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitorWindowMs: number;
}
```

### Caching Strategy
```typescript
interface CacheConfig {
  // Redis-based caching
  chatHistory: { ttlMinutes: 60 }; // conversation context
  courseOutlines: { ttlHours: 24 }; // generated curricula
  userMemories: { ttlDays: 7 }; // semantic search results
  analytics: { ttlHours: 1 }; // computed metrics
}
```

### Rate Limiting
```typescript
interface RateLimitConfig {
  auth: { rpm: 10, burst: 20 };
  chat: { rpm: 30, burst: 50 }; // separate limit for chat endpoints
  llm: { rpm: 20, burst: 30 }; // protect against quota exhaustion
  api: { rpm: 100, burst: 200 }; // general API endpoints
}
```

### Observability
```typescript
interface ObservabilityConfig {
  structuredLogs: boolean;
  tracing: {
    enabled: boolean;
    sampleRate: number;
    jaegerEndpoint?: string;
  };
  metrics: {
    enabled: boolean;
    prometheusPort: number;
  };
  requestId: {
    header: 'X-Request-ID';
    generateFn: () => string; // ULID or UUID
  };
}
```

### Environment Configuration
```typescript
interface Config {
  database: {
    url: string;
    maxConnections: number;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    rotateRefreshTokens: boolean;
  };
  llm: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model: string;
    fallbackModel?: string; // backup when quota exceeded
    embeddingModel: string; // for memory search
    maxTokens: number;
    temperature: number;
  };
  storage: {
    bucket: string;
    region: string;
    cdnUrl?: string;
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  security: {
    bcryptRounds: number;
    corsOrigins: string[];
    allowedFileTypes: string[];
  };
  ops: {
    retry: RetryConfig;
    circuitBreaker: CircuitBreakerConfig;
    cache: CacheConfig;
    rateLimit: RateLimitConfig;
    observability: ObservabilityConfig;
  };
}
```

### Deployment Checklist
- [ ] Database migrations with proper indexes
- [ ] Redis cluster for session storage & caching  
- [ ] LLM quota monitoring & alerting
- [ ] Structured logging with request IDs
- [ ] Health check endpoints (`/health`, `/ready`)
- [ ] Graceful shutdown handling
- [ ] Security headers & CORS configuration
- [ ] Rate limiting per user/IP
- [ ] Backup & disaster recovery procedures