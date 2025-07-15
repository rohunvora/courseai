#!/bin/bash

# CourseAI Demo Testing Script
# Starts the app with demo data for PM testing

set -e

echo "🚀 Starting CourseAI Demo Environment..."
echo "========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copying from template..."
    cp .env.template .env
    echo "📝 Please edit .env with your API keys, then run this script again."
    exit 1
fi

# Check for required environment variables
source .env
if [ -z "$OPENAI_API_KEY" ] || [ -z "$SUPABASE_URL" ]; then
    echo "❌ Missing required environment variables in .env"
    echo "Please set OPENAI_API_KEY and SUPABASE_URL"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Set up database if needed
echo "🗄️  Setting up database..."
npm run setup:database || echo "Database already set up"

# Generate a temporary admin token for demo
export ADMIN_TOKEN="demo-token-$(date +%s)"
export ENABLE_PREVIEW_FEATURES=true

echo ""
echo "🌱 Seeding demo data..."
# Use curl to seed demo data
curl -X POST http://localhost:3001/api/admin/seed-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --silent --show-error || echo "Will seed after server starts..."

# Start the development server
echo ""
echo "🏃 Starting development servers..."
echo "========================================="
echo "📱 Frontend: http://localhost:3002"
echo "🔧 Backend:  http://localhost:3001"
echo "========================================="
echo ""
echo "Demo Accounts:"
echo "  📧 demo@example.com / demo123 (experienced user)"
echo "  📧 test@example.com / test123 (beginner)"
echo ""
echo "Testing Tips:"
echo "  1. Try: 'I did bench press 3x8 at 135 lbs'"
echo "  2. Test safety: 'Can I increase weight by 30%?'"
echo "  3. Click Journal to see workout history"
echo ""
echo "Press Ctrl+C to stop the servers"
echo "========================================="

# Start both servers
npm run dev