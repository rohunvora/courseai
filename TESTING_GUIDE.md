# 🧪 CourseAI Testing Guide

## Quick Local Testing

### 1. Environment Setup (2 minutes)
```bash
# Clone the repo
git clone https://github.com/rohunvora/courseai.git
cd courseai

# Copy environment template
cp .env.template .env

# Add your OpenAI API key to .env:
OPENAI_API_KEY=your-key-here
# (Supabase keys optional - app works without them)
```

### 2. One-Command Start
```bash
./dev-start.sh
```
**That's it!** Opens browser to http://localhost:3002

## 🎯 Feature Testing Checklist

### ✅ Basic Chat & Streaming
- [ ] Type "Hello!" - should get streaming response
- [ ] Verify tokens appear in real-time (not all at once)

### ✅ Workout Logging (Core Feature)
- [ ] **Test**: "I did 3 sets of bench press at 135lbs for 10, 8, 6 reps"
- [ ] **Expected**: AI logs workout automatically and confirms "✅ Workout logged!"
- [ ] **Verify**: Check backend logs for structured data

### ✅ Progress Updates
- [ ] **Test**: "Actually that last set was 145lbs, not 135"  
- [ ] **Expected**: AI updates previous entry and confirms "✅ Progress updated!"

### ✅ Progress Analytics  
- [ ] **Test**: "What's my best bench press?"
- [ ] **Expected**: AI retrieves and reports personal records
- [ ] **Test**: "How much volume did I do this week?"
- [ ] **Expected**: AI calculates and reports weekly volume

### ✅ Goal Management
- [ ] **Test**: "I want to focus more on endurance training now"
- [ ] **Expected**: AI updates course goals and confirms "✅ Goals updated!"

### ✅ Journal/Progress Drawer
- [ ] **Click**: 📋 Journal button (top right)
- [ ] **Expected**: Slide-out drawer with recent workouts
- [ ] **Verify**: Shows date, exercise type, and workout summaries

### ✅ Memory & Context
- [ ] Log a few workouts, then ask "What did I do yesterday?"
- [ ] **Expected**: AI remembers and references previous conversations

## 🚀 Production Deployment Testing

The app is ready for production deployment. You can deploy to:

### Vercel (Frontend Only)
```bash
cd frontend
npx vercel --prod
```

### Railway/Render (Full Stack)
- Connect GitHub repo
- Set environment variables
- Deploy with `npm run build && npm start`

## 📊 Backend API Testing

### Direct API Tests
```bash
# Health check
curl http://localhost:3001/health

# Create course
curl -X POST http://localhost:3001/api/courses \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "Strength Training", "currentLevel": "beginner"}'

# Test streaming chat
curl -X POST http://localhost:3001/api/chat/{courseId}/message \\
  -H "Accept: text/event-stream" \\
  -d '{"message": "I did 5 pushups"}'
```

### Database Verification
```bash
# Check database connection
npm run check:database

# View recent progress logs
npm run test:extraction
```

## 🐛 Troubleshooting

### Common Issues

**Chat not working?**
- Check OpenAI API key in `.env`
- Verify `ENABLE_FUNCTION_CALLING=true`

**No workout logging?**
- Mention specific exercises with sets/reps/weights
- Example: "bench press", "3 sets", "135lbs", "10 reps"

**Database errors?**
- App works without Supabase (memory disabled)
- For full features, add Supabase keys to `.env`

**Build failures?**
- Run `npm install` in both root and `frontend/` directories
- Check Node version (16+ required)

## 🎬 Demo Script

Perfect testing sequence:

```
1. "Hello! I'm ready to start my workout"
2. "I just did 3 sets of bench press at 135lbs for 10, 8, 6 reps"
3. "I also did squats: 3 sets of 8 reps at 185 lbs"
4. "Actually, that bench press was 145lbs, not 135"
5. "What's my best bench press so far?"
6. "How much total volume did I lift today?"
7. "I want to focus more on building endurance now"
8. Click 📋 Journal to see logged workouts
```

Expected: All commands work naturally with confirmations and proper data tracking.

## ✨ Advanced Features to Test

- **Conversation Memory**: Ask about previous workouts
- **Form Advice**: "How should I improve my bench press form?"
- **Progressive Overload**: "Should I increase weight next time?"
- **Injury Prevention**: "My shoulder hurts during bench press"
- **Goal Tracking**: "Am I making good progress toward my goals?"

The AI should provide helpful, contextual responses for all queries while automatically logging structured workout data in the background.