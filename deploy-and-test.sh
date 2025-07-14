#!/bin/bash

# CourseAI Auto-Deploy and Test Script
# This script will start the app and automatically open it in your browser
# with comprehensive logging for debugging

echo "🚀 Starting CourseAI Auto-Deploy and Test..."
echo "=================================================="

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to log with timestamp and colors
log() {
    echo -e "${2}$(date '+%Y-%m-%d %H:%M:%S') - $1${NC}"
}

# Check if required files exist
log "Checking environment setup..." $BLUE
if [ ! -f ".env" ]; then
    log "❌ .env file not found. Creating from template..." $YELLOW
    cp .env.template .env
    log "📝 Please edit .env file and add your OpenAI API key, then run this script again." $RED
    log "   OPENAI_API_KEY=your-key-here" $RED
    exit 1
fi

# Check if OpenAI API key is set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    log "❌ OpenAI API key not found in .env file" $RED
    log "📝 Please edit .env file and add: OPENAI_API_KEY=your-key-here" $RED
    exit 1
fi

log "✅ Environment configuration found" $GREEN

# Install dependencies if needed
log "Installing dependencies..." $BLUE
if [ ! -d "node_modules" ]; then
    log "📦 Installing backend dependencies..." $YELLOW
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    log "📦 Installing frontend dependencies..." $YELLOW
    cd frontend && npm install && cd ..
fi

log "✅ Dependencies installed" $GREEN

# Kill any existing processes on our ports
log "🧹 Cleaning up existing processes..." $BLUE
pkill -f "tsx.*index.ts" || true
pkill -f "vite" || true
sleep 2

# Start backend with enhanced logging
log "🔧 Starting backend server (port 3001)..." $BLUE
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!

# Start frontend with enhanced logging  
log "🎨 Starting frontend server (port 3002)..." $BLUE
cd frontend && npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for servers to start
log "⏳ Waiting for servers to start..." $YELLOW
sleep 5

# Check if backend is running
log "🔍 Checking backend health..." $BLUE
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null; then
        log "✅ Backend is running on http://localhost:3001" $GREEN
        break
    fi
    if [ $i -eq 10 ]; then
        log "❌ Backend failed to start. Check backend.log for details." $RED
        tail -20 backend.log
        exit 1
    fi
    sleep 2
done

# Check if frontend is running
log "🔍 Checking frontend..." $BLUE
for i in {1..15}; do
    if curl -s http://localhost:3002 > /dev/null; then
        log "✅ Frontend is running on http://localhost:3002" $GREEN
        break
    fi
    if [ $i -eq 15 ]; then
        log "❌ Frontend failed to start. Check frontend.log for details." $RED
        tail -20 frontend.log
        exit 1
    fi
    sleep 2
done

# Open browser automatically
log "🌐 Opening CourseAI in your browser..." $PURPLE
if command -v open > /dev/null; then
    # macOS
    open http://localhost:3002
elif command -v xdg-open > /dev/null; then
    # Linux
    xdg-open http://localhost:3002
elif command -v start > /dev/null; then
    # Windows
    start http://localhost:3002
else
    log "🔗 Please manually open: http://localhost:3002" $CYAN
fi

log "🎉 CourseAI is now running!" $GREEN
echo "=================================================="
echo -e "${GREEN}🎯 READY FOR TESTING!${NC}"
echo ""
echo -e "${CYAN}Frontend:${NC} http://localhost:3002"
echo -e "${CYAN}Backend:${NC} http://localhost:3001"
echo -e "${CYAN}Health Check:${NC} http://localhost:3001/health"
echo -e "${CYAN}Action Logs:${NC} http://localhost:3001/api/actions/recent"
echo ""
echo -e "${YELLOW}📊 LIVE MONITORING:${NC}"
echo -e "${BLUE}Backend Logs:${NC} tail -f backend.log"
echo -e "${BLUE}Frontend Logs:${NC} tail -f frontend.log"
echo ""
echo -e "${PURPLE}🧪 TEST THESE FEATURES:${NC}"
echo "1. 💬 Chat: 'I did 3 sets of bench press at 135lbs for 10, 8, 6 reps'"
echo "2. ✏️  Update: 'Actually that last set was 145lbs, not 135'"
echo "3. 📊 Analytics: 'What's my best bench press?'"
echo "4. 🎯 Goals: 'I want to focus more on endurance now'"
echo "5. 📋 Journal: Click the Journal button"
echo ""
echo -e "${GREEN}All your actions will be logged in real-time!${NC}"
echo ""

# Start live log monitoring in the background
log "📡 Starting live action monitoring..." $BLUE

# Function to monitor actions
monitor_actions() {
    while true; do
        sleep 3
        if curl -s http://localhost:3001/api/actions/recent > /dev/null 2>&1; then
            # Get recent actions and display them nicely
            recent_actions=$(curl -s http://localhost:3001/api/actions/recent | jq -r '.actions[-5:][] | "[\(.timestamp | .[11:19])] \(.action): \(.details.action // .details.url // .details.messageType // "N/A")"' 2>/dev/null || echo "")
            if [ ! -z "$recent_actions" ]; then
                clear
                echo -e "${GREEN}🎯 LIVE ACTION MONITORING - CourseAI${NC}"
                echo "=================================================="
                echo -e "${CYAN}Last 5 Actions:${NC}"
                echo "$recent_actions"
                echo ""
                echo -e "${YELLOW}📱 App URL:${NC} http://localhost:3002"
                echo -e "${YELLOW}⚡ Status:${NC} Ready for testing"
                echo ""
                echo -e "${BLUE}Press Ctrl+C to stop monitoring${NC}"
            fi
        fi
    done
}

# Start monitoring in background
monitor_actions &
MONITOR_PID=$!

# Handle cleanup on exit
cleanup() {
    log "🧹 Cleaning up processes..." $YELLOW
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    kill $MONITOR_PID 2>/dev/null || true
    log "👋 CourseAI stopped. Thanks for testing!" $GREEN
}

trap cleanup EXIT

# Keep script running
log "🔄 Monitoring active. Press Ctrl+C to stop..." $CYAN
wait