# CourseAI - AI Fitness Coach

**Complete AI-powered fitness coaching platform** with streaming chat, workout tracking, progress analytics, and intelligent memory system.

## 🚀 Quick Start

```bash
# 1. Clone and setup
git clone <your-repo>
cd courseai

# 2. Copy and configure environment
cp .env.template .env
# Edit .env with your API keys (see below)

# 3. Install dependencies
npm install
cd frontend && npm install && cd ..

# 4. Start development
./dev-start.sh
```

**Open http://localhost:3002** to start chatting with your AI fitness coach!

### Environment Configuration

Copy `.env.template` to `.env` and fill in your API keys:

**Required:**
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/)
- `SUPABASE_URL` - Your Supabase project URL  
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

**Quick Setup:**
1. **OpenAI**: Create account → API Keys → Create new key
2. **Supabase**: New project → Settings → API → Copy URL & Keys
3. **Database**: Run migrations: `npm run setup:database`

**Optional Configuration:**
- `OPENAI_MODEL` - Default: gpt-4o
- `OPENAI_EMBEDDING_MODEL` - Default: text-embedding-3-small
- `ENABLE_FUNCTION_CALLING` - Default: true (enables workout logging)

## ✨ Features

### 🧠 AI-Powered Coaching
- **Streaming Chat:** Real-time GPT-4o responses with token streaming
- **Function Calling:** AI automatically logs workouts from conversation  
- **Memory System:** Remembers your workouts and progress across sessions
- **Smart Tools:** Update progress, get summaries, modify goals via natural language
- **Safety First:** Built-in safeguards for proper progression and injury prevention
- **A/B Testing:** Advanced prompt optimization with variant testing

### 📊 Progress Tracking  
- **Auto-Logging:** "I did 3 sets of bench press at 135lbs" → automatically logged
- **Smart Detection:** Only offers logging when specific metrics provided
- **Progress Updates:** "Actually that was 145lbs" → automatically corrected
- **Analytics:** "What's my best bench press?" → instant personal records
- **Journal Drawer:** View 10 most recent workouts with details
- **Personal Records:** Tracks PRs without emoji clutter in data

### 🎯 Course Management
- **Course Creation:** Automatic strength training course setup
- **Session Tracking:** Real-time workout and learning sessions  
- **Goal Updates:** "I want to focus more on endurance" → goals updated
- **Structured Data:** All progress stored in Postgres with embeddings

## 🎯 Try It Out

### Basic Workout Logging
```
You: "I just did 3 sets of bench press at 135lbs for 10, 8, 6 reps"
AI: "Great job! I've logged your bench press workout. That's solid progressive overload with the decreasing reps. ✅ Workout logged!"
```

### Progress Corrections  
```
You: "Actually that last set was 145lbs, not 135"
AI: "No problem! I've updated your last set to 145lbs. Nice strength gain! ✅ Progress updated!"
```

### Analytics & Progress
```
You: "What's my best bench press?"
AI: "Your current bench press PR is 185lbs! You've been consistently improving - great work!"
```

### Goal Updates
```
You: "I want to focus more on endurance training now"
AI: "Got it! I've updated your course goals to focus on endurance and cardio. ✅ Goals updated!"
```

### Journal View
- Click **📋 Journal** button to see your 10 most recent workouts
- View date, exercise type, and workout summaries
- Track your progress over time

## 🛠️ Development

```bash
# Backend only (API server)
npm run dev

# Frontend only (React app) 
cd frontend && npm run dev

# Full pipeline smoke test
npm run smoke-test:full

# Linting & type checking
npm run lint && npm run type-check

# Run prompt testing framework
npm run test:prompts

# Watch mode for prompt testing
npm run test:prompts:watch
```

## 🚀 Deployment

### Vercel (One-Click Deploy)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/courseai)

**Manual Setup:**
1. **Fork this repo** and connect to Vercel
2. **Set environment variables** in Vercel dashboard:
   ```
   OPENAI_API_KEY=your-key
   SUPABASE_URL=your-url  
   SUPABASE_ANON_KEY=your-key
   SUPABASE_SERVICE_ROLE_KEY=your-key
   ENABLE_FUNCTION_CALLING=true
   NODE_ENV=production
   ```
3. **Deploy!** - Frontend and backend auto-configured

### Alternative Platforms
- **Railway**: Auto-detects setup, just add environment variables
- **Render**: Works with default build commands
- **Heroku**: Compatible with Procfile included

**Build Commands:**
- Root: `npm run build` → builds both frontend and backend
- Frontend: `npm run vercel-build` → optimized for Vercel
- Backend: Auto-deployed as serverless function

## Core Endpoints

### 🧠 Conversation Engine
- `POST /api/chat/{courseId}/message` - Chat with AI (supports streaming)
- `GET /api/chat/{courseId}/history` - Get conversation history

### 📚 Course Management  
- `POST /api/courses` - Create a new course
- `GET /api/courses/{courseId}` - Get course details
- `POST /api/curriculum/generate` - Generate course outline (AI-powered)

### 📊 Progress Tracking
- `POST /api/sessions` - Start a learning session
- `POST /api/progress/log` - Log activity/achievement  
- `GET /api/progress/recent?courseId={id}&limit=10` - Get recent progress logs
- `GET /api/progress/{courseId}` - Get progress history

### 🤖 AI Function Tools (Auto-triggered)
- `log_workout` - Logs workout data from conversation
- `update_progress` - Updates previous workout entries
- `get_progress_summary` - Gets progress analytics & personal records
- `update_course_goal` - Modifies course goals and preferences

### 🔧 Utilities
- `GET /health` - Health check
- `GET /api/test` - Simple test endpoint

## Example Usage

### 1. Create a Course
```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Strength Training for Beginners",
    "currentLevel": "beginner",
    "goals": ["build muscle", "improve form"]
  }'
```

### 2. Generate Curriculum
```bash
curl -X POST http://localhost:3000/api/curriculum/generate \
  -H "Content-Type: application/json" \
  -d '{"courseId": "your-course-id"}'
```

### 3. Start Session & Chat
```bash
# Start session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "your-course-id",
    "sessionType": "practice",
    "plannedDuration": 60
  }'

# Chat with AI
curl -X POST http://localhost:3000/api/chat/your-course-id/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I just did 3 sets of bench press at 135lbs. How did I do?",
    "sessionId": "your-session-id",
    "context": {"current_exercise": "bench_press"}
  }'
```

### 4. Streaming Chat
```bash
curl -X POST http://localhost:3000/api/chat/your-course-id/message \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "Give me a motivational message!"}'
```

## Key Features

- **Streaming AI Responses** - Real-time token streaming via Server-Sent Events
- **Auto-Progress Logging** - AI extracts workout data from conversations and logs automatically  
- **Course Generation** - AI creates structured curricula based on topics and skill levels
- **Session Management** - Track learning sessions with duration and type
- **Memory Context** - Conversations maintain context across messages

## 🏗️ Architecture

```
src/
├── db/
│   ├── schema.ts      # Drizzle ORM schema (users, courses, progress_logs, user_memory, tool_calls)
│   └── index.ts       # Database connection & exports
├── routes/
│   ├── chat-tools.ts  # Streaming chat with function calling
│   ├── courses.ts     # Course management
│   ├── progress.ts    # Progress tracking & recent logs
│   └── auth.ts        # Authentication (Supabase)
├── services/
│   ├── openai-tools.ts # GPT-4o integration + function calling
│   ├── tools.ts       # Tool functions (workout logging, progress updates)
│   ├── memory.ts      # Embedding pipeline & memory retrieval
│   ├── prompt-selector.ts # A/B testing variant selection
│   └── model-selector.ts  # GPT-4o vs O3 decision logic
├── config/
│   └── prompts.ts     # Centralized prompt configuration
└── index.ts           # Fastify server setup

frontend/
├── src/
│   ├── components/
│   │   ├── Chat.tsx   # Streaming chat interface
│   │   └── Journal.tsx # Progress drawer with recent workouts
│   └── App.tsx        # Main application
└── vite.config.ts     # Build configuration
```

### Key Technologies
- **Backend:** Node.js + Fastify + TypeScript
- **Database:** PostgreSQL (Supabase) + Drizzle ORM + pgvector
- **AI:** OpenAI GPT-4o + Function Calling + Embeddings
- **Frontend:** React + TypeScript + Vite
- **Deployment:** Vercel (serverless functions)

## 🔬 Advanced Features

### Prompt Engineering & Safety
- **10% Load Rule:** Never recommends >10% weekly weight increases
- **Pain Response:** Immediate stop instructions for sharp pain
- **Context Pruning:** Automatic memory optimization at 1500 tokens
- **Personalization:** Adapts tone based on user experience level
- **Fallback Support:** Manual logging template when tools disabled

### A/B Testing Framework
- **4 Variant Types:** Testing tone, memory, logging, and safety approaches
- **User Segmentation:** Automatic categorization (beginner/intermediate/advanced)
- **Metrics Tracking:** Tool accuracy, response specificity, safety compliance
- **Statistical Analysis:** P-value comparison between variants

### Model Selection (GPT-4o vs O3)
- **GPT-4o:** Real-time chat, tool usage, complex reasoning
- **O3-Mini:** Background tasks, summarization, cost optimization
- **Auto-Fallback:** Switches to O3 on rate limits or errors

## Next Steps

1. **Add Authentication** - JWT middleware for user management
2. **Build Simple UI** - React frontend calling these endpoints
3. **Add Memory Search** - Vector embeddings for user context
4. **Enhanced Analytics** - Streak tracking, achievement system
5. **Real-time Features** - WebSocket for live coaching

## Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `./dev-start.sh` - Start both backend and frontend

### Database
- `npm run setup:database` - Setup Supabase database schema
- `npm run check:database` - Check database tables and connection
- `npm run test:connection` - Test Supabase connectivity
- `npm run db:migrate` - Run database migrations

### Testing & Quality
- `npm run test:smoke` - Run API smoke tests
- `npm run test:prompts` - Run prompt variant testing
- `npm run lint` - Run ESLint checks
- `npm run type-check` - Run TypeScript type checking

### Monitoring
- `/api/experiments/results` - View A/B test results (admin only)
- `/api/experiments/compare/:variantA/:variantB` - Statistical comparison
- `/monitor/dashboard` - Action tracking dashboard

The brain is ready! 🧠✨