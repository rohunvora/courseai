# Courses AI - Sprint-0 MVP

**AI-powered personalized course platform** with streaming chat interface and intelligent progress tracking.

## 🚀 Getting Started

```bash
# 1. Clone and setup
git clone <your-repo>
cd courseai

# 2. Configure environment
cp .env.template .env.local   # then fill in the keys
# Edit .env.local with your API keys

# 3. Start everything
./dev-start.sh                # runs everything
```

**Open http://localhost:3002** to start chatting with your AI fitness coach!

### Environment Setup

**Required:**
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/)

**Optional (for authentication):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)

> **Note:** App works without Supabase - auth features will be disabled but core AI chat works perfectly!

## ✨ What's Working

- **🧠 AI Brain:** GPT-4o powered conversation with streaming responses
- **📚 Course Generation:** Automatic curriculum creation  
- **🏃 Session Tracking:** Real-time workout and learning sessions
- **📊 Auto-Logging:** AI extracts workout data from natural conversation
- **🔐 Authentication:** Supabase Auth integration (optional)
- **📁 Structured Logging:** JSON logs with request tracing

## 🎯 Demo Flow

1. **Start the app** → Creates a "Strength Training" course automatically
2. **Chat with AI coach** → "I did 3 sets of bench press at 135lbs with 8, 7, 6 reps"
3. **See real-time streaming** → AI responds token-by-token with encouragement & advice  
4. **Auto-logging works** → Workout data automatically extracted and saved
5. **View progress** → Check backend logs for structured activity tracking

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
```

## 🚀 Deployment

### Vercel (Recommended)

**Backend:**
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy - works out of the box!

**Frontend:**
1. Create new Vercel project for `frontend/` folder
2. Set build command: `npm run build`
3. Set environment variables with `VITE_` prefix

### Railway/Render
Works with default settings - just set environment variables.

**Build commands work everywhere:**
- Backend: `npm run build && npm start`
- Frontend: `npm run build` (serves from `dist/`)

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
- `GET /api/progress/{courseId}` - Get progress history

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

## Architecture

```
src/
├── db/                 # Database schema & connection
├── routes/             # API endpoints
├── services/           # OpenAI integration
├── types/              # TypeScript types & validation
└── index.ts           # Server setup
```

## Next Steps

1. **Add Authentication** - JWT middleware for user management
2. **Build Simple UI** - React frontend calling these endpoints
3. **Add Memory Search** - Vector embeddings for user context
4. **Enhanced Analytics** - Streak tracking, achievement system
5. **Real-time Features** - WebSocket for live coaching

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push schema to database
- `npm run smoke-test` - End-to-end API testing

The brain is ready! 🧠✨