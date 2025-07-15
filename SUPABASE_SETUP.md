# Supabase Edge Functions Setup Guide

## Overview

CourseAI now uses Supabase Edge Functions for the backend API, eliminating the need for a separate backend service.

## Edge Functions Created

1. **chat-message** - Handles streaming chat with OpenAI
2. **create-course** - Creates new training courses
3. **create-session** - Creates chat/workout sessions
4. **get-progress** - Retrieves workout logs and progress
5. **admin-seed-demo** - Seeds demo data (admin protected)

## Environment Variables

### Frontend (.env)
```bash
VITE_SUPABASE_URL=https://wwnbcnslkdupmuofqmey.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_TOKEN=your-secure-admin-token
```

### Supabase Edge Functions (set in Supabase Dashboard)
```bash
OPENAI_API_KEY=your-openai-api-key
ADMIN_TOKEN=your-secure-admin-token
```

## Setting Edge Function Secrets

1. Go to your Supabase Dashboard
2. Navigate to Edge Functions
3. Click on "Manage secrets"
4. Add the required secrets:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ADMIN_TOKEN`: A secure token for admin endpoints

## Local Development

To test Edge Functions locally:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref wwnbcnslkdupmuofqmey

# Serve functions locally
supabase functions serve
```

## Deployment

Edge Functions are automatically deployed when you push to the Supabase project. The frontend on Vercel will automatically connect to them.

## Benefits

1. **No Backend Hosting**: Everything runs on Supabase
2. **Auto-scaling**: Functions scale with demand
3. **Global Edge Network**: Low latency worldwide
4. **Integrated Auth**: Built-in user authentication
5. **Cost Effective**: Pay only for execution time

## Troubleshooting

### CORS Issues
- Edge Functions include CORS headers for all origins
- Preflight requests are handled automatically

### Authentication
- Frontend passes Supabase auth token automatically
- Functions verify JWT tokens for user endpoints
- Admin endpoints check x-admin-token header

### Debugging
- Check function logs in Supabase Dashboard
- Use `supabase functions serve` for local debugging
- Browser DevTools Network tab shows function responses