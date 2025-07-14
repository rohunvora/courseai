# CourseAI Development Plan

## Vision
Build an AI fitness coach that remembers everything, learns from your progress, and handles all tracking automatically - one integrated tool instead of juggling ChatGPT + fitness apps.

## Current State (40% Complete)
- ✅ Streaming AI chat with GPT-4o
- ✅ Basic course creation
- ✅ Session management  
- ✅ Workout data extraction (not wired to save)
- ❌ No memory between sessions
- ❌ No ability to modify data via chat
- ❌ No progress visualization
- ❌ No adaptive coaching logic

## Development Philosophy
- **Simple and working** over complex and powerful
- **Build it right** - 4 weeks to solid MVP
- **Integration is key** - One tool, not two
- **System prompts** drive the intelligence

---

# 4-Week Development Plan

## Week 1: Memory System + Basic Function Calling
**Goal:** AI remembers everything AND can log workouts, creating real data to remember

### Parallel Tracks
**Track A: Memory Infrastructure**
1. **Enable Vector Storage** (Day 1-2)
   ```sql
   CREATE EXTENSION vector;
   CREATE TABLE user_memory (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Privacy compliance
     course_id UUID REFERENCES courses(id),
     content TEXT,
     embedding vector(1536),
     embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small', -- Model versioning
     metadata JSONB,
     importance_score FLOAT DEFAULT 1.0,
     redacted BOOLEAN DEFAULT FALSE, -- User-controlled deletion
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

**Track B: Minimal Function Calling**
1. **Implement log_workout Tool** (Day 1-2)
   - Simple function to create progress_logs entries
   - Wire extraction to actually save data
   - Basic validation (units, ranges)

2. **Implement Memory Pipeline** (Day 2-3)
   - Batch embeddings (up to 100 messages/minute) for cost control
   - On each chat: queue for embedding → batch process → store
   - On each workout log: generate summary → embed → store with high importance
   - Build `getRelevantMemories()` with token budget (max 1500 tokens)

3. **Testing & Monitoring** (Day 3)
   - Jest test: 3 chats + 1 workout → assert next reply references workout
   - Create `tool_calls` audit table for failure tracking
   - Add rate limiting: 100 requests/hour per user

4. **Enhanced System Prompts** (Day 3-4)
   - Inject user's recent workouts into context
   - Include personal records and patterns
   - Add course goals and timeline
   - Add safety guardrails: "Never recommend >10% load increase per week"
   - Include timezone-aware dates (store user.timezone at signup)

5. **Memory Retrieval Service** (Day 4-5)
   - Similarity search for relevant memories
   - Combine semantic + recency scoring
   - Limit context to 2000 tokens
   - Cache frequently accessed memories

### Deliverables
- Every conversation includes relevant history
- AI references specific past workouts  
- Workouts are actually logged when mentioned
- Automated test suite proves memory recall works
- Cost tracking dashboard for embeddings

---

## Week 2: Full Function Calling & Data Modification
**Goal:** AI can directly modify tables and take actions, not just chat

### Tasks
1. **Define Tool Schema** (Day 1)
   ```typescript
   const tools = [
     {
       name: "log_workout",
       description: "Log a workout activity",
       parameters: {
         exercise: string,
         sets: number,
         reps: number[],
         weight: number[]
       }
     },
     {
       name: "update_progress", 
       description: "Update or correct a previous log",
       parameters: {
         logId: string,
         updates: object
       }
     },
     {
       name: "get_progress_summary",
       description: "Get user's progress for specific metrics",
       parameters: {
         metric: string,
         timeframe: string
       }
     },
     {
       name: "update_course_goal",
       description: "Modify course goals or timeline",
       parameters: {
         courseId: string,
         updates: object
       }
     }
   ];
   ```

2. **Implement OpenAI Function Calling** (Day 2-3)
   - Update `OpenAIService` to support tools
   - Parse function calls from responses
   - Execute functions and return results
   - Stream both text and function results

3. **Wire Up Database Operations** (Day 3-4)
   - Each tool maps to database operations
   - Unit conversion handling (kg vs lbs)
   - Error bubbles: "I couldn't log that—could you clarify units?"
   - Audit trail in `tool_calls` table
   - Real-time updates to frontend

4. **Smart Extraction Pipeline** (Day 4-5)
   - When user mentions workout → auto-call `log_workout`
   - When user corrects data → auto-call `update_progress`
   - Confirmation UX for modifications

### Deliverables
- "I did 3x10 bench at 135" → automatically logged
- "Actually it was 145 lbs" → automatically corrected
- "Show me my squat progress" → chart appears in chat
- All through natural conversation

---

## Week 3: Progress Visualization & Analytics  
**Goal:** Users can see their progress without leaving the chat

### Tasks
1. **Progress API Endpoints** (Day 1-2)
   ```typescript
   GET /api/progress/:courseId/summary
   GET /api/progress/:courseId/exercises/:exercise
   GET /api/progress/:courseId/trends
   GET /api/progress/:courseId/records
   ```

2. **In-Chat Visualizations** (Day 2-3)
   - Simple line charts with Recharts
   - Server-side PNG fallback for slow connections
   - Render charts inline in chat messages
   - Mobile-responsive design

3. **Progress Analytics Service** (Day 3-4)
   - SQL snapshot tests for PR detection logic
   - Calculate trends and patterns
   - Identify PRs and plateaus
   - Weekly/monthly summaries
   - Predictive goal tracking

4. **AI-Generated Insights** (Day 4-5)
   - AI analyzes progress data
   - Provides coaching insights
   - Suggests program adjustments
   - Celebrates milestones

### Deliverables
- Charts appear directly in chat
- AI explains what the data means
- Actionable insights, not just numbers

---

## Week 4: Polish & Production
**Goal:** Production-ready system with excellent UX

### Tasks
1. **System Prompt Optimization** (Day 1-2)
   - Set up A/B testing with experiments table
   - Fine-tune memory injection
   - Optimize for helpful, concise responses
   - Add personality and motivation

2. **Production Infrastructure** (Day 2-3)
   - GitHub Actions CI/CD pipeline
   - Drizzle migrations (no raw SQL)
   - OpenAI 429 error handling with backoff
   - Monitoring dashboards

3. **Privacy & Safety** (Day 3-4)
   - User data deletion endpoint (GDPR)
   - /forget command for memory control
   - Injury prevention guardrails
   - Export data feature

4. **Quick Wins & Polish** (Day 4-5)
   - Basic offline support (IndexedDB cache)
   - Streak tracking  
   - Timezone-aware summaries
   - Cost monitoring dashboard

### Deliverables
- Reliable, fast, production-ready
- Delightful user experience
- Ready for beta users

---

# Technical Architecture

## Memory System Design
```
User Message → Embedding → Vector Store
                    ↓
            Similarity Search
                    ↓
         Relevant Memories (max 2k tokens)
                    ↓
           Enhanced System Prompt
                    ↓
              GPT-4 Response
                    ↓
         Function Calls + Text Response
```

## Function Calling Flow
```
User: "I just did 3 sets of squats at 225"
  ↓
AI: Detects workout mention
  ↓
Calls: log_workout({exercise: "squats", sets: 3, weight: [225]})
  ↓
Database: Creates progress_log entry
  ↓
AI: "Great work! That's your heaviest squat session this month..."
```

## System Prompt Structure
```
You are a personal AI fitness coach with access to {user_name}'s complete training history.

CONTEXT:
- Current course: {course_title} ({current_week}/{total_weeks})
- Recent workouts: {last_3_workouts}
- Personal records: {pr_list}
- Current goals: {goals}
- Patterns noticed: {ai_insights}

CAPABILITIES:
- You can log workouts using log_workout()
- You can update previous logs using update_progress()
- You can show progress charts using get_progress_summary()
- You can modify goals using update_course_goal()

PERSONALITY:
- Encouraging but honest
- Technical when discussing form
- Celebratory for achievements
- Gentle but firm about consistency
```

---

# Quality Assurance & Cost Control

## Testing Strategy
1. **Unit Tests**: Every function has a test
2. **Integration Tests**: User journey from chat → log → recall
3. **Snapshot Tests**: SQL calculations remain stable
4. **Load Tests**: 100 concurrent users don't break embeddings

## Cost Controls  
1. **Embedding Batching**: Queue and batch every minute
2. **Token Budgeting**: Max 1500 tokens context, 2000 response
3. **Caching**: 5-minute TTL on memory queries
4. **Rate Limiting**: 100 requests/hour per user
5. **Monitoring**: Daily cost alerts if >$50/day

## Migration Strategy
1. **Week 1**: Adopt Drizzle migrations
2. **No raw SQL**: All schema changes via migration files
3. **Rollback Plan**: Each migration has a down() function
4. **Testing**: Migration dry-run in CI before deploy

# Deferred to Post-MVP
1. **Interactive Course Builder** - Static courses are fine if memory works
2. **Advanced Analytics** - Basic charts sufficient for MVP  
3. **Social Features** - Focus on single-user excellence first
4. **Mobile App** - PWA with offline support is enough

---

# Success Metrics

1. **Memory Recall**: AI references past workouts in 90% of relevant conversations
2. **Auto-Logging**: 95% of workout mentions are correctly logged without explicit commands
3. **User Retention**: Users check progress at least 3x per week
4. **Single Tool**: Users stop using separate fitness apps

---

# Risk Mitigation

1. **Memory Context Limits**
   - Solution: Smart summarization and relevance scoring
   
2. **Function Calling Accuracy**
   - Solution: Confirmation UX for critical operations
   
3. **Progress Calculation Complexity**
   - Solution: Start simple (max weight, total volume)
   
4. **System Prompt Token Costs**
   - Solution: Aggressive caching and context pruning

---

# Next Immediate Steps

1. **Today**: Set up Drizzle migrations and create migration for user_memory table
2. **Tomorrow**: Enable pgvector AND implement log_workout function
3. **Day 3**: Create first Jest test for memory recall
4. **Day 4**: Deploy embeddings batch processor
5. **Day 5**: Ship Week 1 and measure memory recall accuracy

## Trigger Word for Execution

When you're ready to start implementation, begin the next conversation with:

**"EXECUTE_MEMORY_ALPHA"**

This will initiate Week 1 implementation with full context of this plan.