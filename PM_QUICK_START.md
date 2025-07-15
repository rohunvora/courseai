# 🚀 PM Quick Start - CourseAI Testing

## Vercel Preview (Full Stack)

Every PR gets a preview URL with full functionality! No backend setup required.

### How It Works
- **Frontend**: Deployed to Vercel preview URL
- **Backend**: Runs on Supabase Edge Functions (serverless)
- **Database**: Uses Supabase PostgreSQL
- **Demo Data**: Click "Reset & Seed Demo" button to populate

### Testing Steps
1. Open the Vercel preview URL from your PR
2. Click "🌱 Reset & Seed Demo" button
3. Use demo credentials:
   - `demo@example.com` / `demo123` - Experienced user
   - `test@example.com` / `test123` - Beginner user

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

Supabase provides our complete backend:
- **Database**: PostgreSQL for storing user data, workouts, etc.
- **Authentication**: User login/signup (coming soon)
- **Edge Functions**: Serverless API endpoints (replaces Fastify)
- **File Storage**: Profile pictures, documents (future)

Architecture: `Frontend → Supabase Edge Functions → Database`

No separate backend server needed!

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