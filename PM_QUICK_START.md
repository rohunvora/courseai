# 🚀 PM Quick Start - CourseAI Testing

## Option 1: Vercel Preview (Frontend Only)

Every PR gets a preview URL. Since the backend requires API keys and database access, we provide two options:

### A. Use Staging Backend
Your preview frontend will connect to our staging backend at:
- API URL: `https://courseai-staging.herokuapp.com/api`
- Demo accounts work automatically

### B. Run Backend Locally
If you need to test backend changes:

```bash
# One-time setup
git clone https://github.com/rohunvora/courseai
cd courseai
cp .env.template .env
# Get API keys from team lead and add to .env

# Start backend
npm install
npm run dev

# Your preview frontend will connect to http://localhost:3001
```

## Option 2: Full Local Testing

For complete control over both frontend and backend:

```bash
# Start everything
npm run test:demo

# Opens:
# - Frontend: http://localhost:3002
# - Backend: http://localhost:3001
# - Demo data seeded automatically
```

## What is Supabase?

Supabase provides our:
- **Database**: PostgreSQL for storing user data, workouts, etc.
- **Authentication**: User login/signup
- **File Storage**: Profile pictures, documents (future)

Your Fastify backend connects to Supabase to:
- Read/write user data
- Verify authentication
- Store workout logs

Think of it as: `Frontend → Backend (Fastify) → Database (Supabase)`

## Testing Checklist

- [ ] Preview URL loads
- [ ] "Reset & Seed Demo" button works
- [ ] Can chat with AI coach
- [ ] Workout logging works
- [ ] Safety rules enforced (10% rule)
- [ ] Journal shows history

## Common Issues

**"API Error"**: Backend not running or wrong URL
**"Auth Error"**: Check Supabase credentials in .env
**"No response"**: OpenAI API key missing/invalid

## Need Help?

- Slack: #courseai-testing
- Backend logs: Check terminal running `npm run dev`
- Frontend logs: Browser DevTools Console