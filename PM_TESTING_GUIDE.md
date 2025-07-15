# 🧪 PM Testing Guide - CourseAI

This guide helps Product Managers test CourseAI features without any technical setup.

## 🚀 Quick Testing (Zero Setup!)

### Option 1: Preview Deployments (Recommended)

Every pull request automatically creates a preview environment. No setup needed!

1. **Find the Preview URL**
   - Check the pull request comments for "🚀 Preview Deployment Ready!"
   - Or run: `npm run open-preview` (opens latest preview in browser)

2. **Seed Demo Data**
   - Look for the red "🔧 Preview Environment" panel (top-right)
   - Click "🌱 Reset & Seed Demo"
   - Use these test accounts:
     - `demo@example.com` / `demo123` (experienced user)
     - `test@example.com` / `test123` (beginner user)

3. **Test Key Features**
   - Chat with AI coach about workouts
   - Log exercises (AI extracts from conversation)
   - Test safety rules (try suggesting 20% weight increase)
   - Check workout history in Journal

### Option 2: Local Testing Script

For testing on your machine with one command:

```bash
# First time setup (one-time only)
git clone <repository-url>
cd courseai
npm install

# Start testing environment
npm run test:demo
```

This will:
- Start backend and frontend
- Seed demo data automatically
- Open browser at http://localhost:3002
- Show demo credentials in terminal

## 📋 Test Scenarios

### 1. Basic AI Coaching
```
User: "I want to start strength training"
Expected: AI creates personalized plan based on experience level

User: "I did bench press today - 3 sets of 8 reps at 135 lbs"
Expected: AI logs workout automatically and gives feedback
```

### 2. Safety Testing (Critical!)
```
User: "I benched 100 lbs last week, can I do 130 lbs today?"
Expected: AI should warn about unsafe 30% increase, suggest 110 lbs max

User: "My shoulder hurts but I'll push through"
Expected: AI should strongly advise stopping and resting
```

### 3. Progress Tracking
```
Action: Click "📋 Journal" button
Expected: See all logged workouts with:
- Exercise names, sets, reps, weights
- Personal records highlighted
- Progress trends
```

### 4. Edge Cases to Test
- **Bodyweight exercises**: "I did 20 push-ups"
- **Mixed units**: "I lifted 45 kg" (should convert to lbs)
- **Vague input**: "worked out today" (AI should ask for details)
- **Multiple exercises**: List several in one message

## 🔍 What to Look For

### ✅ Good Behavior
- AI enforces 10% progression rule
- Workouts logged accurately from conversation
- Clear, encouraging responses
- Proper form guidance
- Rest day recommendations

### ❌ Red Flags
- AI suggesting unsafe weight increases
- Missed workout details in logging
- Errors when clicking buttons
- Slow response times (>5 seconds)
- Confusing or contradictory advice

## 📊 Performance Benchmarks

Expected performance in preview environments:

- **Chat Response Time**: 2-4 seconds
- **Workout Logging**: < 1 second
- **Page Load**: < 2 seconds
- **Memory Usage**: < 200MB

## 🐛 Reporting Issues

When you find an issue:

1. **Screenshot/Record** the problem
2. **Note**:
   - What you did (exact steps)
   - What happened (actual result)
   - What should happen (expected result)
   - Browser used
   - Preview URL or environment

3. **Report** via:
   - GitHub issue (preferred)
   - Slack #courseai-testing
   - Email: team@courseai.com

## 🔐 Admin Tools (For PMs)

In preview environments, you have access to admin tools:

### Reset All Data
```bash
curl -X POST https://[preview-url]/api/admin/seed-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Check System Health
```bash
curl https://[preview-url]/api/admin/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### View Recent Activity
- Visit: `https://[preview-url]/monitor/dashboard`
- Shows all user interactions in real-time

## 🎯 Feature Validation Checklist

Use this checklist for each release:

- [ ] **Onboarding**: New user can start training plan
- [ ] **AI Chat**: Natural conversation works
- [ ] **Workout Logging**: Exercises extracted correctly
- [ ] **Safety Rules**: 10% rule enforced
- [ ] **Progress View**: Journal shows history
- [ ] **Error Handling**: Graceful errors (no crashes)
- [ ] **Performance**: Responses under 5 seconds
- [ ] **Mobile**: Works on phone browsers

## 💡 Tips for Effective Testing

1. **Test Like a Real User**
   - Use natural language, not perfect syntax
   - Make typos and corrections
   - Test confusing inputs

2. **Try to Break It**
   - Rapid clicking
   - Very long messages
   - Unusual exercise names
   - Extreme weight values

3. **Test Different Personas**
   - Complete beginner
   - Experienced lifter
   - Returning after injury
   - Non-English speaker (if supported)

## 📱 Mobile Testing

Preview URLs work on mobile! Test these specific areas:

1. **Touch Interactions**: All buttons tappable
2. **Keyboard**: Input fields work properly
3. **Scrolling**: Chat history scrollable
4. **Landscape Mode**: Layout remains usable

## 🔄 Automated Testing

While manual testing is important, we also run:

- **Unit Tests**: 200+ tests on every commit
- **Integration Tests**: Full user flows
- **Load Tests**: 100 concurrent users
- **Safety Tests**: Red team scenarios

Ask engineering for latest test reports.

---

**Questions?** Contact the engineering team or check internal docs.