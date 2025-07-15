#!/usr/bin/env node

// Simple validation script to check if the test runner loads without errors

console.log('🔍 Validating test runner configuration...');

// Check if required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'tests/prompt-harness/test-runner.ts',
  'src/config/env.ts',
  'src/config/prompts.ts',
  'src/services/tools.ts',
  'tests/scenarios/bench_pr.yaml',
  'tests/scenarios/beginner_pain.yaml',
  'tests/scenarios/logging_offers.yaml',
  'tests/scenarios/progress_check.yaml'
];

let allFilesExist = true;

for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - NOT FOUND`);
    allFilesExist = false;
  }
}

// Check if .env has required variables
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const hasOpenAIKey = envContent.includes('OPENAI_API_KEY=');
  console.log(`✅ .env file exists`);
  console.log(`${hasOpenAIKey ? '✅' : '❌'} OPENAI_API_KEY in .env`);
} else {
  console.log(`❌ .env file missing`);
  allFilesExist = false;
}

// Create reports directory
if (!fs.existsSync('reports')) {
  fs.mkdirSync('reports', { recursive: true });
  console.log('✅ Created reports/ directory');
}

console.log('\n🔍 Summary:');
if (allFilesExist) {
  console.log('✅ All required files are present');
  console.log('✅ Test runner should be ready to use');
  console.log('\nTo run the test harness:');
  console.log('  npx tsx tests/prompt-harness/test-runner.ts');
  console.log('\nOr use the helper script:');
  console.log('  ./test-prompt-runner.sh');
} else {
  console.log('❌ Some required files are missing');
  console.log('Please check the files marked as NOT FOUND above');
  process.exit(1);
}