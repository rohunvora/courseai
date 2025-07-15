# Prompt Testing & A/B Framework

## Overview

This framework provides comprehensive testing and A/B experimentation for CourseAI's prompt engineering, addressing the key issues identified in the prompt review.

## Key Improvements Implemented

### 1. Safety & Liability
- Hard guard-rails on weight progression (max 10% per week)
- Immediate stop instructions for sharp pain
- Contextual safety warnings based on user input

### 2. Smart Logging Offers
- Only offers logging when user provides concrete metrics
- Asks clarifying questions for vague workout mentions
- Reduces spammy repetitive offers

### 3. Context Management
- Automatic pruning for memories >1500 tokens
- Summary generation for older memories
- Efficient token usage

### 4. Personalization
- Dynamic tone based on user segment (beginner/intermediate/advanced)
- Experience-appropriate language and guidance
- Adaptive encouragement levels

### 5. Tool Calling Clarity
- Clear directive to use tools when available
- Waits for tool results before responding
- Fallback instructions for no-tool mode

## Running Tests

### Quick Test
```bash
npm run test:prompts
```

### Watch Mode (for development)
```bash
npm run test:prompts:watch
```

### Custom Scenarios
Add YAML files to `tests/scenarios/` with this structure:
```yaml
id: scenario_name
context:
  topic: "Training Focus"
  currentWeek: 5
  personalRecords: [...]
userMessages:
  - "User message 1"
  - "User message 2"
expect:
  toolCalls:
    - name: expected_tool
  checks:
    - "expected phrase"
  safetyCheck: true  # for pain scenarios
```

## A/B Testing Framework

### Variant Configuration
Variants test different combinations of:
- **Tone**: trainer_friend, strict_coach, science_nerd
- **Memory Load**: full, summary, recent_only  
- **Logging Offer**: always, metric_detected, user_initiated
- **Safety Level**: short, detailed, contextual

### User Segmentation
Users are automatically segmented based on:
- **Beginners**: <4 weeks
- **Intermediate**: 4-26 weeks
- **Advanced**: >26 weeks + PR frequency
- **Returning**: >10 days inactive

### Metrics Tracked
1. **Tool Call Accuracy**: Correct function calls
2. **Response Specificity**: Uses actual user data
3. **Safety Compliance**: Appropriate pain response
4. **User Engagement**: Interaction quality

## Model Selection Strategy

### GPT-4o (Default)
- Real-time chat with tools
- Complex reasoning tasks
- High token contexts
- User-facing interactions

### O3-Mini (Fallback/Background)
- Summarization tasks
- Batch processing
- Cost optimization
- Non-real-time operations

### Automatic Fallback
System automatically falls back to O3 when:
- Rate limits hit on 4o
- Background processing tasks
- Large summarization jobs

## Database Schema

New table: `prompt_experiments`
- Tracks variant selection per user/session
- Records outcomes and metrics
- Enables statistical analysis

## API Endpoints

### View Results
```
GET /api/experiments/results
```
Admin-only endpoint showing variant performance

### Compare Variants
```
GET /api/experiments/compare/:variantA/:variantB
```
Statistical comparison with p-values

## Production Deployment

1. Run migration:
```bash
psql $DATABASE_URL < migrations/008_prompt_experiments.sql
```

2. Enable experiment tracking in env:
```
FEATURE_EXPERIMENTS=true
```

3. Monitor via dashboard:
```
http://localhost:3002/api/experiments/results
```

## Success Metrics

### Stop Conditions
- Tool accuracy <90% over 200 calls
- Any critical safety failure
- Specificity p-value <0.05 worse than control

### Success Indicators
- Tool accuracy ≥95%
- Response specificity ≥80%
- Zero safety violations
- Improved user engagement

## Next Steps

1. Deploy to staging for initial testing
2. Run for 1 week with 10% of users
3. Analyze results and pick winning variant
4. Gradually roll out to all users
5. Continue iterating with new variants