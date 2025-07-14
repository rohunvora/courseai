#!/usr/bin/env tsx

/**
 * Smoke Test for CourseAI API
 * Tests all critical endpoints to ensure the system is working
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_ID = 'test-user-123';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  duration: number;
}

async function testEndpoint(
  method: string,
  endpoint: string,
  body?: any
): Promise<TestResult> {
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - start;
    
    return {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      duration,
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    };
  }
}

async function runSmokeTest() {
  console.log('🚬 CourseAI Smoke Test\n');
  console.log(`📍 API Base: ${API_BASE}\n`);

  const results: TestResult[] = [];
  let courseId: string | null = null;
  let sessionId: string | null = null;

  // Test 1: Health Check
  console.log('1️⃣  Testing health check...');
  const healthResult = await testEndpoint('GET', '/health');
  results.push(healthResult);
  console.log(healthResult.success ? '✅ Health check passed' : '❌ Health check failed');

  // Test 2: Create Course
  console.log('\n2️⃣  Testing course creation...');
  const courseResult = await testEndpoint('POST', '/api/courses', {
    userId: TEST_USER_ID,
    topic: 'Smoke Test - Fitness',
    currentLevel: 'beginner',
    targetLevel: 'intermediate',
    timelineWeeks: 12,
    preferences: {
      focusAreas: ['strength', 'cardio'],
      equipment: ['dumbbells', 'resistance bands'],
    },
  });
  results.push(courseResult);
  
  if (courseResult.success) {
    const response = await fetch(`${API_BASE}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        topic: 'Smoke Test - Fitness',
        currentLevel: 'beginner',
        targetLevel: 'intermediate',
        timelineWeeks: 12,
        preferences: {},
      }),
    });
    const data = await response.json();
    courseId = data.courseId;
    console.log(`✅ Course created: ${courseId}`);
  } else {
    console.log('❌ Course creation failed');
  }

  // Test 3: Get Course
  if (courseId) {
    console.log('\n3️⃣  Testing course retrieval...');
    const getCourseResult = await testEndpoint('GET', `/api/courses/${courseId}`);
    results.push(getCourseResult);
    console.log(getCourseResult.success ? '✅ Course retrieved' : '❌ Course retrieval failed');
  }

  // Test 4: Create Session
  if (courseId) {
    console.log('\n4️⃣  Testing session creation...');
    const sessionResult = await testEndpoint('POST', '/api/sessions', {
      userId: TEST_USER_ID,
      courseId,
      sessionType: 'workout',
      plannedDuration: 45,
    });
    results.push(sessionResult);
    
    if (sessionResult.success) {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          courseId,
          sessionType: 'workout',
          plannedDuration: 45,
        }),
      });
      const data = await response.json();
      sessionId = data.sessionId;
      console.log(`✅ Session created: ${sessionId}`);
    } else {
      console.log('❌ Session creation failed');
    }
  }

  // Test 5: Chat Stream
  if (courseId) {
    console.log('\n5️⃣  Testing chat stream...');
    const chatResult = await testEndpoint('POST', '/api/chat/stream', {
      courseId,
      sessionId,
      message: 'Hello, this is a smoke test!',
    });
    results.push(chatResult);
    console.log(chatResult.success ? '✅ Chat endpoint responsive' : '❌ Chat endpoint failed');
  }

  // Test 6: Progress Logging
  if (courseId) {
    console.log('\n6️⃣  Testing progress logging...');
    const progressResult = await testEndpoint('POST', '/api/progress', {
      userId: TEST_USER_ID,
      courseId,
      sessionId,
      activityType: 'workout',
      data: {
        exercise: 'Push-ups',
        sets: 3,
        reps: [15, 12, 10],
      },
      metrics: {
        totalReps: 37,
        duration: 5,
      },
    });
    results.push(progressResult);
    console.log(progressResult.success ? '✅ Progress logged' : '❌ Progress logging failed');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SMOKE TEST SUMMARY\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.method} ${r.endpoint}: ${r.error || `Status ${r.status}`}`);
      });
  }

  // Performance summary
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`\n⚡ Average response time: ${avgDuration.toFixed(0)}ms`);

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the smoke test
console.log('Starting smoke test in 1 second...\n');
setTimeout(runSmokeTest, 1000);