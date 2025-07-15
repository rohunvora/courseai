#!/usr/bin/env tsx

/**
 * Test Summary Report
 * Provides an overview of all testing capabilities
 */

import { existsSync } from 'fs';
import { join } from 'path';

console.log('🧪 CourseAI Testing Framework Summary\n');
console.log('=' .repeat(60));

// Check test files
const testSuites = [
  {
    name: '📝 YAML Test Scenarios',
    path: 'tests/scenarios',
    files: 25,
    description: 'Covers all user segments and edge cases'
  },
  {
    name: '🔧 Unit Tests',
    path: 'tests/unit',
    files: 2,
    description: 'Tests prompt functions and model selection'
  },
  {
    name: '📡 API Tests',
    path: 'tests/api',
    files: 1,
    description: 'Contract tests for experiments API'
  },
  {
    name: '💥 Chaos Tests',
    path: 'tests/chaos',
    files: 1,
    description: 'Fault injection and failure scenarios'
  },
  {
    name: '🚀 Load Tests',
    path: 'tests/load',
    files: 2,
    description: 'k6 performance and stress tests'
  }
];

console.log('📊 Test Coverage:\n');
for (const suite of testSuites) {
  const exists = existsSync(suite.path);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${suite.name}`);
  console.log(`   Path: ${suite.path}`);
  console.log(`   Files: ${suite.files}`);
  console.log(`   ${suite.description}\n`);
}

// Available commands
console.log('🎯 Available Test Commands:\n');
const commands = [
  { cmd: 'npm test', desc: 'Run unit and API tests' },
  { cmd: 'npm run test:prompts', desc: 'Test all prompt variants' },
  { cmd: 'npm run test:load', desc: 'Run k6 load tests (requires k6)' },
  { cmd: 'npm run replay:test', desc: 'Replay production logs' },
  { cmd: 'npm run quality:check', desc: 'Check quality gates' },
];

for (const { cmd, desc } of commands) {
  console.log(`  ${cmd.padEnd(25)} - ${desc}`);
}

// Quality metrics
console.log('\n📈 Quality Gate Thresholds:\n');
const thresholds = [
  { metric: 'Tool Call Error Rate', warning: '3%', critical: '5%' },
  { metric: 'Safety Violations', warning: '0', critical: '1' },
  { metric: 'P95 Latency', warning: '2.5s', critical: '3s' },
];

console.log('  Metric                    Warning   Critical');
console.log('  ' + '-'.repeat(45));
for (const { metric, warning, critical } of thresholds) {
  console.log(`  ${metric.padEnd(25)} ${warning.padEnd(9)} ${critical}`);
}

// Testing capabilities
console.log('\n✨ Key Testing Capabilities:\n');
const capabilities = [
  '• A/B testing with 4 prompt variants',
  '• User segmentation (beginner/intermediate/advanced/returning)',
  '• Automatic safety violation detection',
  '• Kill-switch for problematic variants',
  '• Real-time quality monitoring',
  '• Model fallback (GPT-4o → O3)',
  '• Token budget management (<1500)',
  '• Regression detection via replay tests',
];

for (const cap of capabilities) {
  console.log(cap);
}

// What to evaluate
console.log('\n🔍 What to Evaluate:\n');
console.log('1. **Prompt Test Results** (npm run test:prompts)');
console.log('   - Tool call accuracy (target: >95%)');
console.log('   - Response specificity (target: >80%)');
console.log('   - Safety compliance (target: 100%)');
console.log('   - Response times (target: <3s)');
console.log('');
console.log('2. **Load Test Results** (npm run test:load)');
console.log('   - P95 latency under load');
console.log('   - Error rates at 500 concurrent users');
console.log('   - Database connection stability');
console.log('');
console.log('3. **Quality Monitoring** (automatic)');
console.log('   - Check logs for safety violations');
console.log('   - Monitor variant performance');
console.log('   - Verify auto-disable triggers');
console.log('');
console.log('4. **API Endpoints** (manual testing)');
console.log('   - GET /api/experiments/results');
console.log('   - GET /api/experiments/variants/status');
console.log('   - POST /api/experiments/variants/:id/disable');

console.log('\n' + '='.repeat(60));
console.log('📚 Full documentation: tests/PROMPT_TESTING_README.md');
console.log('🚀 Ready for evaluation!\n');