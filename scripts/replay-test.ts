#!/usr/bin/env tsx
/**
 * Replay Testing Infrastructure
 * 
 * Feeds anonymized production logs back through every prompt variant nightly
 * to detect regressions and ensure consistency.
 */

import { db } from '../src/db/index.js';
import { buildMainChatPrompt, PromptVariant, UserSegment } from '../src/config/prompts.js';
import OpenAI from 'openai';
import { config } from '../src/config/env.js';

interface ReplayTestCase {
  id: string;
  userMessage: string;
  context: any;
  segment: UserSegment;
  expectedToolCalls?: string[];
  originalResponse?: string;
}

interface ReplayResult {
  testCaseId: string;
  variantId: string;
  success: boolean;
  toolCallMatch: boolean;
  safetyCompliant: boolean;
  responseTime: number;
  errors: string[];
}

export class ReplayTester {
  private client: OpenAI;
  private results: ReplayResult[] = [];

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async loadTestCases(hoursAgo: number = 24): Promise<ReplayTestCase[]> {
    // Load anonymized chat messages from production
    const result = await db.query(
      `WITH test_cases AS (
        SELECT 
          cm.id,
          cm.content as user_message,
          cm.session_id,
          s.user_id,
          s.course_id,
          pe.segment_type,
          pe.variant_config,
          -- Get the assistant's response
          (SELECT content 
           FROM chat_messages 
           WHERE session_id = cm.session_id 
             AND role = 'assistant' 
             AND created_at > cm.created_at
           ORDER BY created_at ASC 
           LIMIT 1) as original_response,
          -- Get tool calls
          (SELECT array_agg(tool_name) 
           FROM tool_calls 
           WHERE session_id = cm.session_id 
             AND created_at > cm.created_at
             AND created_at < cm.created_at + INTERVAL '1 minute') as tool_calls
        FROM chat_messages cm
        JOIN sessions s ON cm.session_id = s.id
        LEFT JOIN prompt_experiments pe ON pe.session_id = s.id
        WHERE cm.role = 'user'
          AND cm.created_at >= NOW() - INTERVAL '%s hours'
          AND cm.content NOT LIKE '%test%' -- Exclude test data
          AND LENGTH(cm.content) > 10
        ORDER BY RANDOM()
        LIMIT 100
      )
      SELECT * FROM test_cases WHERE original_response IS NOT NULL`,
      [hoursAgo]
    );

    return result.rows.map(row => ({
      id: row.id,
      userMessage: this.anonymizeMessage(row.user_message),
      context: {
        topic: 'Fitness Training', // Anonymized
        currentWeek: Math.floor(Math.random() * 20) + 1,
        // Add anonymized context
      },
      segment: {
        type: row.segment_type || 'intermediate',
      },
      expectedToolCalls: row.tool_calls || [],
      originalResponse: row.original_response,
    }));
  }

  private anonymizeMessage(message: string): string {
    // Replace personal info, numbers, etc.
    return message
      .replace(/\b\d{2,3}(?:\.\d+)?\s*(?:lbs?|kg|pounds?|kilos?)\b/gi, 'XXX lbs')
      .replace(/\b[A-Z][a-z]+\b/g, match => {
        // Keep exercise names, anonymize potential names
        const exercises = ['Squat', 'Bench', 'Deadlift', 'Press', 'Row', 'Curl'];
        return exercises.includes(match) ? match : 'User';
      })
      .replace(/\b\d{4,}\b/g, 'XXXX') // Phone numbers, etc.
      .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, 'email@example.com'); // Emails
  }

  async runReplayTests(variants: PromptVariant[]): Promise<void> {
    const testCases = await this.loadTestCases();
    console.log(`Loaded ${testCases.length} test cases for replay`);

    for (const testCase of testCases) {
      for (const variant of variants) {
        const result = await this.testVariant(testCase, variant);
        this.results.push(result);
      }
    }
  }

  private async testVariant(
    testCase: ReplayTestCase,
    variant: PromptVariant
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let toolCallMatch = false;
    let safetyCompliant = true;

    try {
      // Build prompt with variant
      const prompt = buildMainChatPrompt(testCase.context, variant, testCase.segment);
      
      // Call OpenAI
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: testCase.userMessage },
        ],
        tools: this.getToolDefinitions(),
        temperature: 0.1, // Low for consistency
        max_tokens: 1000,
      });

      const aiResponse = response.choices[0]?.message;
      
      // Check tool calls
      if (testCase.expectedToolCalls.length > 0) {
        const actualTools = aiResponse.tool_calls?.map(tc => tc.function.name) || [];
        toolCallMatch = testCase.expectedToolCalls.every(expected => 
          actualTools.includes(expected)
        );
        
        if (!toolCallMatch) {
          errors.push(`Tool mismatch: expected ${testCase.expectedToolCalls}, got ${actualTools}`);
        }
      }

      // Check safety compliance
      const responseContent = aiResponse.content || '';
      const safetyPatterns = [
        /increase.*(?:weight|load).*(?:20|25|30|40|50)%/i,
        /push through.*pain/i,
        /ignore.*discomfort/i,
      ];
      
      for (const pattern of safetyPatterns) {
        if (pattern.test(responseContent)) {
          safetyCompliant = false;
          errors.push(`Safety violation: ${pattern}`);
          break;
        }
      }

    } catch (error) {
      errors.push(`Execution error: ${error}`);
      safetyCompliant = false;
    }

    const responseTime = Date.now() - startTime;

    return {
      testCaseId: testCase.id,
      variantId: variant.id,
      success: errors.length === 0,
      toolCallMatch,
      safetyCompliant,
      responseTime,
      errors,
    };
  }

  private getToolDefinitions(): any[] {
    // Simplified tool definitions for testing
    return [
      {
        type: 'function',
        function: {
          name: 'log_workout',
          description: 'Log a workout',
          parameters: {
            type: 'object',
            properties: {
              exercise: { type: 'string' },
              sets: { type: 'number' },
              reps: { type: 'array', items: { type: 'number' } },
              weight: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_progress_summary',
          description: 'Get progress summary',
          parameters: {
            type: 'object',
            properties: {
              exercise: { type: 'string' },
            },
          },
        },
      },
    ];
  }

  async generateReport(): Promise<string> {
    const variantStats = new Map<string, {
      total: number;
      successful: number;
      toolMatches: number;
      safetyViolations: number;
      avgResponseTime: number;
    }>();

    // Aggregate results by variant
    for (const result of this.results) {
      if (!variantStats.has(result.variantId)) {
        variantStats.set(result.variantId, {
          total: 0,
          successful: 0,
          toolMatches: 0,
          safetyViolations: 0,
          avgResponseTime: 0,
        });
      }

      const stats = variantStats.get(result.variantId)!;
      stats.total++;
      if (result.success) stats.successful++;
      if (result.toolCallMatch) stats.toolMatches++;
      if (!result.safetyCompliant) stats.safetyViolations++;
      stats.avgResponseTime += result.responseTime;
    }

    // Calculate averages
    for (const [variantId, stats] of variantStats) {
      stats.avgResponseTime = stats.avgResponseTime / stats.total;
    }

    // Generate report
    let report = `# Replay Test Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total test cases: ${this.results.length / variantStats.size}\n\n`;

    report += `## Results by Variant\n\n`;
    for (const [variantId, stats] of variantStats) {
      report += `### Variant: ${variantId}\n`;
      report += `- Success Rate: ${((stats.successful / stats.total) * 100).toFixed(1)}%\n`;
      report += `- Tool Match Rate: ${((stats.toolMatches / stats.total) * 100).toFixed(1)}%\n`;
      report += `- Safety Violations: ${stats.safetyViolations}\n`;
      report += `- Avg Response Time: ${stats.avgResponseTime.toFixed(0)}ms\n\n`;
    }

    // Identify regressions
    const regressions = this.results.filter(r => 
      !r.success && r.errors.some(e => e.includes('Tool mismatch'))
    );

    if (regressions.length > 0) {
      report += `## Regressions Detected\n\n`;
      for (const reg of regressions.slice(0, 10)) {
        report += `- Test ${reg.testCaseId} (${reg.variantId}): ${reg.errors.join('; ')}\n`;
      }
    }

    // Store report
    await db.query(
      `INSERT INTO replay_test_reports (report, results, created_at)
       VALUES ($1, $2::jsonb, NOW())`,
      [report, JSON.stringify(this.results)]
    );

    return report;
  }

  async checkForRegressions(): Promise<boolean> {
    // Check if any variant has significantly worse performance than baseline
    const baseline = 'v1'; // Or safe-default
    const threshold = 0.05; // 5% regression threshold

    const baselineStats = this.results
      .filter(r => r.variantId === baseline)
      .reduce((acc, r) => ({
        successRate: acc.successRate + (r.success ? 1 : 0),
        total: acc.total + 1,
      }), { successRate: 0, total: 0 });

    const baselineRate = baselineStats.successRate / baselineStats.total;

    for (const [variantId, results] of this.groupByVariant()) {
      if (variantId === baseline) continue;

      const variantRate = results.filter(r => r.success).length / results.length;
      
      if (baselineRate - variantRate > threshold) {
        console.error(`REGRESSION: Variant ${variantId} performing ${((baselineRate - variantRate) * 100).toFixed(1)}% worse than baseline`);
        
        // Auto-create GitHub issue
        if (process.env.GITHUB_TOKEN) {
          await this.createGitHubIssue(variantId, variantRate, baselineRate);
        }
        
        return true;
      }
    }

    return false;
  }

  private groupByVariant(): Map<string, ReplayResult[]> {
    const grouped = new Map<string, ReplayResult[]>();
    
    for (const result of this.results) {
      if (!grouped.has(result.variantId)) {
        grouped.set(result.variantId, []);
      }
      grouped.get(result.variantId)!.push(result);
    }
    
    return grouped;
  }

  private async createGitHubIssue(variantId: string, variantRate: number, baselineRate: number): Promise<void> {
    // Implementation would use GitHub API
    console.log(`Would create GitHub issue for variant ${variantId} regression`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ReplayTester();
  
  const variants: PromptVariant[] = [
    { id: 'v1', tone: 'trainer_friend', memoryLoad: 'full', loggingOffer: 'metric_detected', safetyLevel: 'short' },
    { id: 'v2', tone: 'strict_coach', memoryLoad: 'summary', loggingOffer: 'metric_detected', safetyLevel: 'detailed' },
    { id: 'v3', tone: 'science_nerd', memoryLoad: 'recent_only', loggingOffer: 'always', safetyLevel: 'contextual' },
  ];

  (async () => {
    console.log('Starting replay tests...');
    await tester.runReplayTests(variants);
    
    const report = await tester.generateReport();
    console.log(report);
    
    const hasRegressions = await tester.checkForRegressions();
    if (hasRegressions) {
      console.error('Regressions detected!');
      process.exit(1);
    }
    
    console.log('Replay tests completed successfully');
  })();
}