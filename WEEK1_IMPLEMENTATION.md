# Week 1: Memory System Implementation Guide

## Overview
Transform the AI from goldfish memory to elephant memory. Every conversation will include relevant context from past sessions.

## Day 1-2: Vector Storage Setup

### 1. Enable pgvector in Supabase
```sql
-- Run in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;

-- Update the existing user_memory table or create new
ALTER TABLE user_memory 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS user_memory_embedding_idx 
ON user_memory 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 2. Create Memory Service
```typescript
// src/services/memory.ts
export class MemoryService {
  async storeMemory(
    userId: string,
    courseId: string,
    content: string,
    type: 'chat' | 'workout' | 'insight',
    metadata?: any
  ) {
    // Generate embedding
    const embedding = await this.generateEmbedding(content);
    
    // Store in database
    await db.insert(userMemory).values({
      userId,
      courseId,
      memoryType: type,
      key: `${type}_${Date.now()}`,
      value: {
        content,
        metadata,
        timestamp: new Date()
      },
      embedding,
      importanceScore: this.calculateImportance(content, type)
    });
  }

  async getRelevantMemories(
    userId: string,
    courseId: string,
    query: string,
    limit: number = 10
  ): Promise<Memory[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Hybrid search: semantic + recency
    const memories = await db.execute(sql`
      SELECT 
        key, value, 
        1 - (embedding <=> ${queryEmbedding}) as similarity,
        EXTRACT(epoch FROM (NOW() - created_at)) / 86400 as days_ago
      FROM user_memory
      WHERE user_id = ${userId} 
        AND course_id = ${courseId}
      ORDER BY 
        (0.7 * (1 - (embedding <=> ${queryEmbedding}))) + 
        (0.3 * (1 / (1 + days_ago)))
      DESC
      LIMIT ${limit}
    `);
    
    return memories;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }
}
```

## Day 2-3: Memory Pipeline

### 1. Auto-Memory on Chat
```typescript
// src/routes/chat.ts - Update existing chat endpoint
async function handleChatMessage(request, reply) {
  const { message, courseId, sessionId } = request.body;
  const memoryService = new MemoryService();
  
  // Store user message as memory
  await memoryService.storeMemory(
    userId,
    courseId,
    message,
    'chat',
    { sessionId, role: 'user' }
  );
  
  // Get relevant memories for context
  const memories = await memoryService.getRelevantMemories(
    userId,
    courseId,
    message
  );
  
  // Get recent workout summaries
  const recentWorkouts = await getRecentWorkoutSummary(userId, courseId, 7);
  
  // Build enhanced context
  const context = buildEnhancedContext(memories, recentWorkouts, course);
  
  // Stream response with context
  const stream = await openai.streamChatResponse(message, context);
  
  // Store AI response as memory too
  let aiResponse = '';
  for await (const token of stream) {
    aiResponse += token;
    // ... existing streaming code
  }
  
  await memoryService.storeMemory(
    userId,
    courseId,
    aiResponse,
    'chat',
    { sessionId, role: 'assistant' }
  );
}
```

### 2. Auto-Memory on Progress Logs
```typescript
// src/routes/progress.ts - Update existing endpoint
async function createProgressLog(request, reply) {
  // ... existing code to create log
  
  // Generate workout summary for memory
  const summary = await generateWorkoutSummary(progressLog);
  
  // Store as memory with high importance
  await memoryService.storeMemory(
    userId,
    courseId,
    summary,
    'workout',
    { 
      progressLogId: progressLog.id,
      exercises: progressLog.data,
      metrics: progressLog.metrics
    }
  );
  
  // Check for PRs and store those specially
  const prs = await checkForPersonalRecords(userId, progressLog);
  if (prs.length > 0) {
    await memoryService.storeMemory(
      userId,
      courseId,
      `New personal records: ${prs.map(pr => pr.description).join(', ')}`,
      'insight',
      { type: 'pr', records: prs }
    );
  }
}
```

## Day 3-4: Enhanced System Prompts

### 1. Context Builder
```typescript
// src/services/contextBuilder.ts
export function buildEnhancedContext(
  memories: Memory[],
  recentWorkouts: WorkoutSummary[],
  course: Course,
  user: User
): SystemContext {
  // Format memories into concise bullets
  const memoryContext = memories
    .slice(0, 5) // Top 5 most relevant
    .map(m => `- ${m.value.content}`)
    .join('\n');
  
  // Format recent workouts
  const workoutContext = recentWorkouts
    .map(w => `- ${w.date}: ${w.summary}`)
    .join('\n');
  
  // Get current week in program
  const weekNumber = getWeekNumber(course.createdAt);
  
  return {
    systemPrompt: `You are a personal AI fitness coach for ${user.firstName || 'this user'}.

CURRENT CONTEXT:
- Course: ${course.title} (Week ${weekNumber}/${course.timelineWeeks})
- Level: ${course.currentLevel} → ${course.targetLevel}
- Focus: ${course.preferences?.focusAreas?.join(', ')}

RELEVANT MEMORIES:
${memoryContext}

RECENT WORKOUTS (Last 7 days):
${workoutContext}

INSIGHTS:
${await generateInsights(recentWorkouts)}

Remember to:
- Reference specific past workouts when relevant
- Track progress toward their ${course.targetLevel} goal
- Be encouraging but realistic about timeline
- Suggest adjustments based on patterns you notice`,
    maxTokens: 2000 // Leave room for response
  };
}
```

### 2. Smart Memory Injection
```typescript
// src/services/openai.ts - Update existing service
export class OpenAIService {
  async streamChatResponse(
    message: string,
    context: SystemContext
  ): AsyncGenerator<string> {
    // Intelligently prune context if too long
    const prunedContext = this.pruneContext(context, message);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prunedContext.systemPrompt },
        { role: 'user', content: message }
      ],
      stream: true,
      temperature: 0.7,
    });
    
    // ... existing streaming code
  }
  
  private pruneContext(context: SystemContext, message: string): SystemContext {
    // If context is too long, prioritize based on message content
    const tokens = this.estimateTokens(context.systemPrompt);
    
    if (tokens > context.maxTokens) {
      // Remove least relevant memories
      // Keep recent workouts
      // Preserve course info
      return this.intelligentlyPrune(context, message);
    }
    
    return context;
  }
}
```

## Day 4-5: Memory Retrieval Service

### 1. Similarity Search with Caching
```typescript
// src/services/memoryCache.ts
export class MemoryCache {
  private cache = new Map<string, CachedMemory[]>();
  private ttl = 5 * 60 * 1000; // 5 minutes
  
  async getMemories(
    userId: string,
    courseId: string,
    query: string
  ): Promise<Memory[]> {
    const cacheKey = `${userId}-${courseId}-${this.normalizeQuery(query)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.ttl) {
        return cached.memories;
      }
    }
    
    // Fetch from database
    const memories = await this.memoryService.getRelevantMemories(
      userId,
      courseId,
      query
    );
    
    // Cache results
    this.cache.set(cacheKey, {
      memories,
      timestamp: Date.now()
    });
    
    return memories;
  }
  
  private normalizeQuery(query: string): string {
    // Simple normalization for cache key
    return query.toLowerCase().trim().substring(0, 50);
  }
}
```

### 2. Workout Summary Generator
```typescript
// src/services/workoutSummary.ts
export async function generateWorkoutSummary(
  progressLog: ProgressLog
): Promise<string> {
  const activities = progressLog.data as any[];
  
  // Create concise, memorable summary
  const exercises = activities.map(a => {
    if (a.sets && a.weight) {
      const maxWeight = Array.isArray(a.weight) 
        ? Math.max(...a.weight.map(w => parseInt(w))) 
        : parseInt(a.weight);
      return `${a.exercise}: ${a.sets}x${a.reps} @ ${maxWeight}lbs`;
    }
    return `${a.exercise}: ${a.sets} sets`;
  });
  
  return exercises.join(', ');
}

export async function getRecentWorkoutSummary(
  userId: string,
  courseId: string,
  days: number
): Promise<WorkoutSummary[]> {
  const logs = await db.query.progressLogs.findMany({
    where: and(
      eq(progressLogs.userId, userId),
      eq(progressLogs.courseId, courseId),
      gte(progressLogs.timestamp, new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    ),
    orderBy: desc(progressLogs.timestamp)
  });
  
  return logs.map(log => ({
    date: log.timestamp.toLocaleDateString(),
    summary: generateWorkoutSummary(log),
    metrics: log.metrics
  }));
}
```

## Testing Plan

### 1. Memory Storage Test
```typescript
// Create a workout log
POST /api/progress
{
  "userId": "test-user",
  "courseId": "test-course",
  "activityType": "workout",
  "data": [{
    "exercise": "Bench Press",
    "sets": 3,
    "reps": [10, 8, 6],
    "weight": [135, 145, 155]
  }]
}

// Verify memory was created
SELECT * FROM user_memory 
WHERE user_id = 'test-user' 
AND memory_type = 'workout';
```

### 2. Memory Retrieval Test
```typescript
// Send a related message
POST /api/chat/test-course/message
{
  "message": "How did my bench press go last time?"
}

// AI should respond with specific reference to 3x10,8,6 @ 135,145,155
```

### 3. Context Injection Test
```typescript
// Check system prompt includes memories
// Add logging to see full context
console.log('ENHANCED CONTEXT:', context.systemPrompt);
```

## Success Criteria

1. **Memory Creation**: Every chat and workout creates a memory entry
2. **Retrieval Accuracy**: Relevant memories appear in context (similarity > 0.7)
3. **Context Quality**: System prompt includes recent workouts and insights
4. **Performance**: Memory retrieval < 100ms with caching
5. **AI Behavior**: AI references specific past events in responses

## Common Pitfalls to Avoid

1. **Token Overflow**: Monitor context length, prune aggressively
2. **Stale Cache**: Set appropriate TTL, invalidate on updates
3. **Embedding Cost**: Batch operations, use smaller model
4. **Relevance Decay**: Weight recency appropriately
5. **Memory Spam**: Don't store every single message

## Next Steps After Week 1

Once memory is working:
1. Add function calling (Week 2)
2. Let AI query memories directly
3. Build memory management UI
4. Add memory categories/tags