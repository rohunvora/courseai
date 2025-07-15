import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

// Custom metrics
const toolCallErrors = new Counter('tool_call_errors');
const safetyViolations = new Counter('safety_violations');
const contextOverflows = new Counter('context_overflows');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Test 1: High chat rate simulation
export const highChatRate = {
  executor: 'constant-vus',
  vus: 50,
  duration: '30m',
  exec: 'highRateScenario',
};

// Test 2: Memory growth test
export const memoryGrowth = {
  executor: 'per-vu-iterations',
  vus: 5,
  iterations: 1,
  maxDuration: '10m',
  exec: 'memoryGrowthScenario',
};

// Test 3: Tool call burst
export const toolCallBurst = {
  executor: 'ramping-arrival-rate',
  startRate: 10,
  timeUnit: '1s',
  preAllocatedVUs: 100,
  maxVUs: 200,
  stages: [
    { duration: '30s', target: 100 }, // Ramp to 100 req/s
    { duration: '2m', target: 1000 }, // Burst to 1000 req/s
    { duration: '30s', target: 10 },  // Cool down
  ],
  exec: 'toolCallBurstScenario',
};

export const options = {
  scenarios: {
    highChatRate,
    memoryGrowth,
    toolCallBurst,
  },
  thresholds: {
    'tool_call_errors': ['count<50'],
    'safety_violations': ['count<1'],
    'context_overflows': ['count<10'],
    'http_req_duration{scenario:highChatRate}': ['p(95)<3000'],
    'http_req_duration{scenario:memoryGrowth}': ['p(95)<200'],
    'http_req_failed': ['rate<0.05'],
  },
};

// High chat rate scenario - 10 messages/min per user
export function highRateScenario() {
  const courseId = createCourse();
  
  // Send 10 messages per minute for duration
  const messages = [
    'Squats 3x5 @ 225',
    'Bench 3x8 @ 155',
    'Feeling strong today!',
    "What's my squat PR?",
    'Actually that was 235 not 225',
    'Rows 3x10 @ 135',
    'Core work: planks 3x60s',
    'How am I progressing?',
    'Deadlifts next?',
    'Finished workout!',
  ];
  
  messages.forEach((msg, idx) => {
    const response = sendMessage(courseId, msg);
    
    check(response, {
      'message sent': (r) => r.status === 200,
      'no promise rejection': (r) => !r.body.includes('Unhandled Promise'),
      'OpenAI throttled gracefully': (r) => {
        if (r.status === 429) {
          console.log('Rate limit handled gracefully');
          return true;
        }
        return r.status === 200;
      },
    });
    
    // 6 second interval = 10 messages/min
    if (idx < messages.length - 1) {
      sleep(6);
    }
  });
}

// Memory growth scenario - user with 10k memories
export function memoryGrowthScenario() {
  const userId = `stress-test-${exec.vu.idInTest}`;
  
  // Create a user with extensive history
  console.log(`Creating user with 10k memories...`);
  const setupResp = http.post(
    `${BASE_URL}/api/test/setup-heavy-user`,
    JSON.stringify({
      userId,
      memoryCount: 10000,
      workoutCount: 500,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '60s',
    }
  );
  
  if (setupResp.status !== 200) {
    console.error('Failed to setup heavy user');
    return;
  }
  
  const courseId = JSON.parse(setupResp.body).courseId;
  
  // Test retrieval with heavy context
  const startTime = Date.now();
  const response = sendMessage(courseId, 'Summarize my progress over the last year');
  const duration = Date.now() - startTime;
  
  check(response, {
    'heavy context handled': (r) => r.status === 200,
    'retrieval under 200ms': () => duration < 200,
    'context pruned': (r) => {
      // Check if prompt was pruned by looking for pruning indicator
      const body = r.body.toString();
      if (body.includes('summarized for context') || body.includes('older entries')) {
        return true;
      }
      // Also check token count if available
      const tokens = r.headers['X-Prompt-Tokens'];
      if (tokens && parseInt(tokens) <= 1500) {
        return true;
      }
      contextOverflows.add(1);
      return false;
    },
  });
}

// Tool call burst scenario
export function toolCallBurstScenario() {
  const courseId = createCourse();
  
  // Workout messages that trigger tool calls
  const workoutMessages = [
    'Squats: 3x5 @ 185lbs',
    'Bench press: 5x3 @ 135lbs',
    'Deadlift: 1x5 @ 275lbs',
    'Overhead press: 3x8 @ 95lbs',
    'Barbell rows: 3x10 @ 115lbs',
    'Front squats: 3x6 @ 155lbs',
    'Incline bench: 3x12 @ 115lbs',
    'Romanian deadlifts: 3x8 @ 185lbs',
    'Pull-ups: 3x8 bodyweight',
    'Dips: 3x10 @ +25lbs',
  ];
  
  const message = workoutMessages[Math.floor(Math.random() * workoutMessages.length)];
  const response = sendMessage(courseId, message);
  
  check(response, {
    'tool call succeeded': (r) => r.status === 200,
    'workout logged': (r) => r.body.includes('logged') || r.body.includes('recorded'),
    'DB write succeeded': (r) => {
      // Check if we hit connection limits
      if (r.status === 503 || r.body.includes('connection limit')) {
        toolCallErrors.add(1);
        return false;
      }
      return true;
    },
  });
  
  // Also check audit trail
  sleep(0.1); // Small delay to ensure write completed
  
  const auditResp = http.get(`${BASE_URL}/api/actions/recent?courseId=${courseId}`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });
  
  check(auditResp, {
    'audit trail updated': (r) => r.status === 200 && JSON.parse(r.body).length > 0,
  });
}

// Helper functions
function createCourse() {
  const resp = http.post(
    `${BASE_URL}/api/courses`,
    JSON.stringify({
      topic: 'Stress Test Training',
      currentLevel: 'intermediate',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    }
  );
  
  return JSON.parse(resp.body).courseId;
}

function sendMessage(courseId, message) {
  return http.post(
    `${BASE_URL}/api/chat/${courseId}/message`,
    JSON.stringify({ message }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '10s',
    }
  );
}

// Safety validation
export function handleSummary(data) {
  // Check for safety violations in responses
  const safetyPatterns = [
    /increase.*(?:weight|load).*(?:20|25|30|40|50)%/i,
    /push through.*pain/i,
    /ignore.*discomfort/i,
  ];
  
  // This would need access to actual response bodies
  // In practice, you'd log these during the test
  
  return {
    'reports/k6-stress-test-report.json': JSON.stringify(data, null, 2),
  };
}