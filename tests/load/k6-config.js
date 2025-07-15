import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Load test configuration based on requirements
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '15m', target: 500 }, // Stay at 500 users for 15 min
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests must complete below 3s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    http_reqs: ['rate>100'],           // Must handle >100 requests/sec
  },
};

// Test data - sample messages from different user segments
const testMessages = new SharedArray('messages', function () {
  return [
    // Beginner messages
    { segment: 'beginner', message: 'I just did my first pushups today!' },
    { segment: 'beginner', message: 'How many sets should I do?' },
    { segment: 'beginner', message: 'My arms are sore, is this normal?' },
    
    // Intermediate messages
    { segment: 'intermediate', message: 'Bench press 3x8 @ 155lbs' },
    { segment: 'intermediate', message: 'Squats felt heavy today, only got 4 reps on last set' },
    { segment: 'intermediate', message: "What's my deadlift PR?" },
    
    // Advanced messages
    { segment: 'advanced', message: 'Hit 315x3 on squats, RPE 8' },
    { segment: 'advanced', message: 'Running Sheiko program, week 3 day 2 complete' },
    { segment: 'advanced', message: 'Need to adjust my opener attempts for the meet' },
    
    // Safety-critical messages
    { segment: 'safety', message: 'Sharp pain in my lower back during deadlifts' },
    { segment: 'safety', message: 'Knee is clicking during squats' },
    
    // High-context messages
    { segment: 'context', message: 'Compare my current bench to 3 months ago' },
    { segment: 'context', message: 'Show me my progression over the last year' },
  ];
});

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Helper to create a user session
function createSession() {
  const sessionData = {
    topic: 'Strength Training',
    currentLevel: randomItem(['beginner', 'intermediate', 'advanced']),
    goals: ['build muscle', 'get stronger'],
  };
  
  const createResp = http.post(`${BASE_URL}/api/courses`, JSON.stringify(sessionData), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });
  
  check(createResp, {
    'course created': (r) => r.status === 201 || r.status === 200,
  });
  
  return JSON.parse(createResp.body).courseId;
}

export default function () {
  // Create a course/session for this VU
  const courseId = createSession();
  
  // Simulate a conversation with think time
  for (let i = 0; i < 10; i++) {
    const messageData = randomItem(testMessages);
    
    const payload = {
      message: messageData.message,
      context: {
        segment: messageData.segment,
      },
    };
    
    const startTime = Date.now();
    
    const response = http.post(
      `${BASE_URL}/api/chat/${courseId}/message`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Accept': 'text/event-stream', // For streaming responses
        },
        timeout: '10s',
      }
    );
    
    const duration = Date.now() - startTime;
    
    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 3s': (r) => duration < 3000,
      'has response content': (r) => r.body && r.body.length > 0,
      'no rate limit': (r) => r.status !== 429,
      'no server error': (r) => r.status < 500,
    });
    
    // Log slow requests
    if (duration > 3000) {
      console.warn(`Slow request: ${duration}ms for message: ${messageData.message}`);
    }
    
    // Think time between messages (30 seconds as specified)
    sleep(30);
  }
  
  // Test progress retrieval
  const progressResp = http.get(`${BASE_URL}/api/progress/${courseId}`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });
  
  check(progressResp, {
    'progress retrieved': (r) => r.status === 200,
  });
}

// Scenario for testing specific user flows
export function handleSummary(data) {
  return {
    'reports/k6-load-test-report.html': htmlReport(data),
    'reports/k6-load-test-summary.json': JSON.stringify(data.metrics),
  };
}

// Custom function to generate HTML report
function htmlReport(data) {
  const date = new Date().toISOString();
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>K6 Load Test Report - ${date}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; background: #f0f0f0; }
        .passed { color: green; }
        .failed { color: red; }
        h2 { color: #333; }
    </style>
</head>
<body>
    <h1>CourseAI Load Test Report</h1>
    <p>Generated: ${date}</p>
    
    <h2>Key Metrics</h2>
    <div class="metric">
        <strong>Total Requests:</strong> ${metrics.http_reqs.count}
    </div>
    <div class="metric">
        <strong>Request Rate:</strong> ${metrics.http_reqs.rate.toFixed(2)} req/s
    </div>
    <div class="metric">
        <strong>P95 Response Time:</strong> ${metrics.http_req_duration.p95.toFixed(2)}ms
        <span class="${metrics.http_req_duration.p95 < 3000 ? 'passed' : 'failed'}">
            (Target: <3000ms)
        </span>
    </div>
    <div class="metric">
        <strong>Error Rate:</strong> ${(metrics.http_req_failed.rate * 100).toFixed(2)}%
        <span class="${metrics.http_req_failed.rate < 0.1 ? 'passed' : 'failed'}">
            (Target: <10%)
        </span>
    </div>
    
    <h2>Detailed Results</h2>
    <pre>${JSON.stringify(data, null, 2)}</pre>
</body>
</html>
  `;
}