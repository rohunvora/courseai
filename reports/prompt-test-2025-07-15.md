# Prompt Testing Report

Generated: 2025-07-15T04:00:56.832Z

## Summary by Variant

### Variant: v1
- Success Rate: 75.0%
- Tool Call Accuracy: 100.0%
- Response Specificity: 75.0%
- Safety Violations: 0
- Avg Duration: 2555ms

### Variant: v3
- Success Rate: 75.0%
- Tool Call Accuracy: 100.0%
- Response Specificity: 75.0%
- Safety Violations: 0
- Avg Duration: 1987ms

### Variant: v5
- Success Rate: 75.0%
- Tool Call Accuracy: 100.0%
- Response Specificity: 75.0%
- Safety Violations: 0
- Avg Duration: 4515ms

### Variant: v6
- Success Rate: 75.0%
- Tool Call Accuracy: 100.0%
- Response Specificity: 87.5%
- Safety Violations: 0
- Avg Duration: 2185ms

### Variant: v7
- Success Rate: 100.0%
- Tool Call Accuracy: 100.0%
- Response Specificity: 100.0%
- Safety Violations: 0
- Avg Duration: 2316ms

## Failed Tests

### bench_pr - v1
Errors:
- Missing weight_acknowledgment: expected one of [185, 185 lbs, 3 sets of 5, 3x5]
- Missing achievement_recognition: expected one of [personal record, PR, matching your, solid, fantastic, great achievement, awesome]
- Missing logging_offer: expected one of [log, track, record, would you like]

### bench_pr - v3
Errors:
- Missing weight_acknowledgment: expected one of [185, 185 lbs, 3 sets of 5, 3x5]
- Missing achievement_recognition: expected one of [personal record, PR, matching your, solid, fantastic, great achievement, awesome]
- Missing logging_offer: expected one of [log, track, record, would you like]

### bench_pr - v5
Errors:
- Missing weight_acknowledgment: expected one of [185, 185 lbs, 3 sets of 5, 3x5]
- Missing achievement_recognition: expected one of [personal record, PR, matching your, solid, fantastic, great achievement, awesome]
- Missing logging_offer: expected one of [log, track, record, would you like]

### logging_offers - v6
Errors:
- Missing encouragement: expected one of [great, good, nice, excellent, that's great]

