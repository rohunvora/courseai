# Environment Variables Setup

The application uses a centralized configuration system that loads environment variables once from the `.env` file.

## Configuration System

All environment variables are loaded through `/src/config/env.ts`. This file:
1. Loads the `.env` file automatically
2. Validates required environment variables
3. Provides typed configuration throughout the app
4. Throws clear errors if required variables are missing

## Required Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Secret
JWT_SECRET=your-jwt-secret-here

# Optional
JWT_EXPIRES_IN=3600
PORT=3001
NODE_ENV=development
ENABLE_FUNCTION_CALLING=true
```

## Benefits

1. **Single Source of Truth**: All env vars are loaded once in `config/env.ts`
2. **Type Safety**: Typed configuration object throughout the app
3. **Early Validation**: App fails fast if required env vars are missing
4. **No More Scattered dotenv.config()**: No need to call dotenv.config() in multiple files
5. **Clear Error Messages**: Tells you exactly which env var is missing

## Usage

```typescript
import { config } from './config/env.js';

// Use typed configuration
const apiKey = config.openai.apiKey;
const port = config.server.port;
```

## Troubleshooting

If you get "Missing required environment variable" errors:
1. Check that `.env` file exists in the root directory
2. Ensure all required variables are set
3. Restart the server after changing `.env`