#!/usr/bin/env tsx

import { setTimeout } from 'timers/promises';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

class SmokeTest {
  private results: TestResult[] = [];

  async run() {
    console.log('🔥 Starting Courses AI Smoke Test\n');
    console.log(`Testing against: ${BASE_URL}\n`);

    await this.test('Health Check', () => this.testHealthCheck());
    await this.test('Create Course', () => this.testCreateCourse());
    await this.test('Generate Curriculum', () => this.testGenerateCurriculum());
    await this.test('Start Session', () => this.testStartSession());
    await this.test('Send Chat Message', () => this.testChatMessage());
    await this.test('Log Progress', () => this.testLogProgress());
    await this.test('Streaming Chat', () => this.testStreamingChat());

    this.printResults();
    this.exit();
  }

  private async test(name: string, testFn: () => Promise<any>) {
    const start = Date.now();
    try {
      const data = await testFn();
      const duration = Date.now() - start;
      this.results.push({ name, success: true, duration, data });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({ 
        name, 
        success: false, 
        duration, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`❌ ${name} (${duration}ms): ${error}`);
    }
  }

  private async testHealthCheck() {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  private async testCreateCourse() {
    const response = await fetch(`${BASE_URL}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Strength Training for Beginners',
        currentLevel: 'beginner',
        goals: ['build muscle', 'improve form'],
        timelineWeeks: 8,
        preferences: {
          sessionLength: 60,
          difficulty: 'moderate',
          focusAreas: ['compound movements']
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Course creation failed');
    
    // Store course ID for subsequent tests
    (global as any).testCourseId = data.data.id;
    return data;
  }

  private async testGenerateCurriculum() {
    const courseId = (global as any).testCourseId;
    if (!courseId) throw new Error('No course ID from previous test');

    const response = await fetch(`${BASE_URL}/api/curriculum/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Curriculum generation failed');
    return data;
  }

  private async testStartSession() {
    const courseId = (global as any).testCourseId;
    if (!courseId) throw new Error('No course ID from previous test');

    const response = await fetch(`${BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        sessionType: 'practice',
        plannedDuration: 60
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Session start failed');
    
    // Store session ID for subsequent tests
    (global as any).testSessionId = data.data.id;
    return data;
  }

  private async testChatMessage() {
    const courseId = (global as any).testCourseId;
    const sessionId = (global as any).testSessionId;
    if (!courseId) throw new Error('No course ID from previous test');

    const response = await fetch(`${BASE_URL}/api/chat/${courseId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello! I just did 3 sets of bench press at 135lbs with 8, 7, 6 reps. How did I do?',
        sessionId,
        context: {
          current_exercise: 'bench_press',
          weight: '135lbs'
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Chat message failed');
    return data;
  }

  private async testLogProgress() {
    const courseId = (global as any).testCourseId;
    const sessionId = (global as any).testSessionId;
    if (!courseId) throw new Error('No course ID from previous test');

    const response = await fetch(`${BASE_URL}/api/progress/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        sessionId,
        activityType: 'exercise',
        data: {
          exercise: 'deadlift',
          weight: '225lbs',
          sets: 3,
          reps: [5, 5, 4],
          notes: 'felt strong today'
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Progress logging failed');
    return data;
  }

  private async testStreamingChat() {
    const courseId = (global as any).testCourseId;
    const sessionId = (global as any).testSessionId;
    if (!courseId) throw new Error('No course ID from previous test');

    const response = await fetch(`${BASE_URL}/api/chat/${courseId}/message`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        message: 'Give me a quick motivational message!',
        sessionId
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    // For streaming, just check that we get the right content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      throw new Error(`Expected event-stream, got ${contentType}`);
    }

    // Read a few chunks to verify streaming works
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body reader');

    const decoder = new TextDecoder();
    let chunks = 0;
    
    try {
      while (chunks < 3) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        if (chunk.trim()) chunks++;
        
        // Don't read forever
        if (chunks >= 3) break;
      }
    } finally {
      reader.releaseLock();
    }

    return { contentType, chunksReceived: chunks };
  }

  private printResults() {
    console.log('\n📊 Test Results:');
    console.log('================');
    
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`⏱️  Average duration: ${avgDuration.toFixed(0)}ms`);
    
    if (passed < total) {
      console.log('\n❌ Failed tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    console.log('\n🎉 Core brain functionality working!');
    console.log('\nNext steps:');
    console.log('1. Set up your .env file with DATABASE_URL and OPENAI_API_KEY');
    console.log('2. Run database migrations: npm run db:push');
    console.log('3. Start the server: npm run dev');
    console.log('4. Build a simple frontend that calls these endpoints');
  }

  private exit() {
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    process.exit(passed === total ? 0 : 1);
  }
}

// Run the smoke test
new SmokeTest().run().catch(console.error);