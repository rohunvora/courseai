#!/bin/bash

# Test the prompt harness runner

echo "🧪 Testing Prompt Harness Runner"
echo "================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with OPENAI_API_KEY"
    exit 1
fi

# Source the .env file to check if OPENAI_API_KEY is set
source .env
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY not set in .env"
    exit 1
fi

echo "✅ Environment configuration found"
echo ""

# Create reports directory if it doesn't exist
mkdir -p reports

# Run the test harness
echo "🚀 Running test harness..."
echo ""
npx tsx tests/prompt-harness/test-runner.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Test harness completed successfully!"
    echo "Check the reports/ directory for results"
else
    echo ""
    echo "❌ Test harness failed!"
    echo "Check the error output above for details"
fi