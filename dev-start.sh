#!/bin/bash

# Courses AI - Development Startup Script
echo "🚀 Starting Courses AI Development Environment"
echo "============================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Check if frontend node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure:"
    echo "   - OPENAI_API_KEY (required for AI features)"
    echo "   - SUPABASE_URL and SUPABASE_ANON_KEY (for auth)"
    echo "   - DATABASE_URL (for local PostgreSQL)"
    echo ""
    echo "💡 For now, you can run without Supabase (auth will be skipped)"
fi

echo "🔧 Starting backend on http://localhost:3001..."
echo "🎨 Starting frontend on http://localhost:3002..."
echo ""
echo "🌐 Open http://localhost:3002 to use the chat interface"
echo "📋 Backend health check: curl http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start both services in parallel
trap 'kill 0' EXIT

# Start backend
npm run dev &

# Wait a moment for backend to start
sleep 3

# Start frontend
cd frontend && npm run dev &

# Wait for both processes
wait