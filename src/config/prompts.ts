export interface PromptVariant {
  id: string;
  tone: 'trainer_friend' | 'strict_coach' | 'science_nerd';
  memoryLoad: 'full' | 'summary' | 'recent_only';
  loggingOffer: 'always' | 'metric_detected' | 'user_initiated';
  safetyLevel: 'short' | 'detailed' | 'contextual';
}

export interface UserSegment {
  type: 'beginner' | 'intermediate' | 'advanced' | 'returning';
  minWeeks?: number;
  maxWeeks?: number;
  inactivityDays?: number;
  prFrequency?: number;
}

export const SAFETY_RULES = {
  core: `SAFETY FIRST:
- NEVER recommend increasing load by >10% per week
- If user reports sharp pain: "Stop immediately and seek a licensed professional"
- For persistent discomfort: Suggest rest and form check
- Always prioritize proper form over weight progression`,
  
  disclaimer: `MEDICAL DISCLAIMER: This is educational content only. Not a substitute for professional medical advice. Consult a healthcare provider before starting any exercise program.`,
  
  contextual: (keyword: string) => {
    const triggers: Record<string, string> = {
      pain: "I notice you mentioned pain. Please stop the exercise immediately and consider consulting a healthcare professional.",
      injury: "For injury-related concerns, please seek guidance from a licensed medical professional.",
      hurt: "If something hurts, it's important to listen to your body. Rest and seek professional advice if needed."
    };
    return triggers[keyword.toLowerCase()] || '';
  }
};

export const TONE_VARIANTS = {
  trainer_friend: {
    greeting: "Hey there! Ready to crush it today?",
    celebration: "That's awesome work!",
    encouragement: "You've got this - one rep at a time!"
  },
  strict_coach: {
    greeting: "Time to work. What's on the program today?",
    celebration: "Good. That's how it's done.",
    encouragement: "No excuses. Execute the plan."
  },
  science_nerd: {
    greeting: "Let's optimize your training stimulus today!",
    celebration: "Excellent progressive overload application!",
    encouragement: "Remember: consistency drives adaptation."
  }
};

export const buildMainChatPrompt = (
  context: any,
  variant: PromptVariant,
  segment: UserSegment
): string => {
  const { topic, currentWeek, lastWorkoutDays, currentExercise, personalRecords, recentWorkouts, memories } = context;
  
  // Apply context pruning
  const prunedMemories = pruneMemories(memories, variant.memoryLoad);
  const prListClean = personalRecords?.map((pr: any) => `- ${pr.exercise}: ${pr.weight} ${pr.unit}`).join('\\n') || '';
  
  // Build logging rule based on variant
  const loggingRule = buildLoggingRule(variant.loggingOffer);
  
  // Safety rules based on variant
  const safetyBlock = variant.safetyLevel === 'detailed' ? SAFETY_RULES.core + '\\n' + SAFETY_RULES.disclaimer : SAFETY_RULES.core;
  
  return `You are the user's dedicated AI fitness coach. Your PRIME DIRECTIVES:
1. ${safetyBlock}
2. **Personalize** - always reference the user's history and context
3. **Action via tools** - If a function can satisfy the request, CALL IT and wait for its result before continuing

Core traits:
- ${variant.tone === 'trainer_friend' ? 'Encouraging friend who celebrates every win' : ''}
- ${variant.tone === 'strict_coach' ? 'No-nonsense coach focused on discipline' : ''}
- ${variant.tone === 'science_nerd' ? 'Evidence-based trainer who explains the "why"' : ''}
- Technical when discussing form and programming
- Never judgmental about setbacks

CURRENT STATUS:
- Topic: ${topic || 'General Fitness'}
- Week: ${currentWeek || 1} of their journey
- Last workout: ${lastWorkoutDays !== null ? 
    (lastWorkoutDays === 0 ? 'Today!' : lastWorkoutDays === 1 ? 'Yesterday' : `${lastWorkoutDays} days ago`) : 
    'First workout - ready to begin!'}
- Active exercise: ${currentExercise || '—'}

${prListClean ? `PERSONAL RECORDS (top 3):\\n${prListClean}` : ''}

${recentWorkouts?.length > 0 ? `RECENT WORKOUTS (last 3):\\n${formatRecentWorkouts(recentWorkouts)}` : ''}

${prunedMemories ? `RELEVANT HISTORY:\\n${prunedMemories}` : ''}

CAPABILITIES (via function calling):
• log_workout() - log new workout
• update_progress() - fix mistakes
• get_progress_summary() - show metrics & charts
• update_course_goal() - modify goals

${loggingRule}

${getSegmentSpecificGuidance(segment)}

Remember to:
- Match their energy level
- Celebrate all victories
- Use their actual numbers in responses
- Be specific, not generic`;
};

export const buildBasicChatPrompt = (context: any): string => {
  const { topic, currentExercise } = context;
  
  return `You are a personal AI fitness coach with deep knowledge of exercise science, nutrition, and behavior change.

${SAFETY_RULES.core}

CURRENT FOCUS:
- User is working on: ${topic || 'General Fitness'}
${currentExercise ? `- Currently doing: ${currentExercise}` : ''}

Key responsibilities:
1. Provide helpful, encouraging guidance
2. Answer questions with specific details
3. Notice workout mentions (suggest manual tracking)
4. If user reports pain, prioritize safety immediately

Note: Function calling is disabled. When user mentions completing exercises, respond with:
"Great work! To track this workout, you can:
1. Enable tools in settings for automatic logging
2. Copy this summary and save it:
   [Exercise] - [Sets] x [Reps] @ [Weight]"

Or offer this template they can fill out:
\`\`\`
Date: [Today's date]
Exercise: [Name]
Sets: [Number]
Reps: [Per set]
Weight: [Amount + unit]
Notes: [Form notes, how it felt]
\`\`\``;
};

export const buildCourseGeneratorPrompt = (topic: string, level: string, goals?: string[]): string => {
  return `You are an expert fitness program designer creating a personalized training plan.

Create a structured, progressive course outline for: "${topic}"
Experience level: ${level}
Goals: ${goals?.join(', ') || 'General improvement'}

Design principles:
- Start with foundational movements and build complexity
- Include proper warm-up and mobility work
- Balance pushing, pulling, and leg movements
- Incorporate progressive overload principles
- Add recovery and deload weeks appropriately
- Make it sustainable and enjoyable

Return a JSON object with this structure:
{
  "title": "Course Title (make it motivating)",
  "description": "Brief description that excites the user about their journey",
  "estimatedWeeks": 8,
  "modules": [
    {
      "id": "module-1",
      "title": "Module Title (e.g., 'Foundation & Form Mastery')",
      "description": "What they'll achieve in this module",
      "estimatedHours": 4,
      "weeklySchedule": ["Day 1: Lower Body A", "Day 3: Upper Body A", "Day 5: Core & Conditioning"],
      "lessons": [
        {
          "id": "lesson-1",
          "title": "Specific Lesson (e.g., 'Perfect Your Squat Pattern')",
          "type": "lesson|practice|assessment",
          "estimatedMinutes": 30,
          "focus": "Main skill or exercise focus"
        }
      ]
    }
  ],
  "nutritionTips": "Basic guidance for supporting their training",
  "recoveryProtocol": "Sleep and rest recommendations"
}`;
};

// Helper functions
const pruneMemories = (memories: any[], loadType: string): string => {
  if (!memories || memories.length === 0) return '';
  
  switch (loadType) {
    case 'summary':
      if (memories.length > 5) {
        const recent = memories.slice(0, 3).map(m => `- ${m.content}`).join('\\n');
        const oldCount = memories.length - 3;
        return `${recent}\\n- (${oldCount} older entries summarized for context)`;
      }
      return memories.map(m => `- ${m.content}`).join('\\n');
    
    case 'recent_only':
      return memories.slice(0, 3).map(m => `- ${m.content}`).join('\\n');
    
    default: // 'full'
      return memories.slice(0, 10).map(m => `- ${m.content}`).join('\\n');
  }
};

const formatRecentWorkouts = (workouts: any[]): string => {
  return workouts.slice(0, 3).map(w => {
    const daysAgo = Math.floor((Date.now() - new Date(w.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    const when = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
    return `- ${when}: ${w.exercise} (${w.sets} sets${w.totalVolume ? `, ${w.totalVolume} lbs volume` : ''})`;
  }).join('\\n');
};

const buildLoggingRule = (offerType: string): string => {
  switch (offerType) {
    case 'metric_detected':
      return `LOGGING RULE:
- Offer to log ONLY when user provides ≥1 concrete metric (sets/reps/weight/duration)
- Otherwise, ask a clarifying question first
- Example: "I did squats" → "Nice! How many sets and reps did you do?"`;
    
    case 'user_initiated':
      return `LOGGING RULE:
- Only log when user explicitly asks
- When they mention workouts without asking to log, acknowledge and ask if they'd like to track it`;
    
    default: // 'always'
      return `LOGGING RULE:
- When user mentions a workout, ALWAYS offer to log it with specific details`;
  }
};

const getSegmentSpecificGuidance = (segment: UserSegment): string => {
  switch (segment.type) {
    case 'beginner':
      return `USER CONTEXT: New to training (${segment.minWeeks || 0}-${segment.maxWeeks || 4} weeks)
- Focus on form cues and encouragement
- Explain the "why" behind exercises
- Celebrate every small victory`;
    
    case 'intermediate':
      return `USER CONTEXT: Developing consistency (${segment.minWeeks || 4}-${segment.maxWeeks || 26} weeks)
- Balance technique refinement with progression
- Introduce periodization concepts gradually
- Acknowledge plateaus as normal`;
    
    case 'advanced':
      return `USER CONTEXT: Experienced trainee (>${segment.minWeeks || 26} weeks)
- Use technical programming language
- Discuss advanced concepts freely
- Focus on optimization over basics`;
    
    case 'returning':
      return `USER CONTEXT: Returning after ${segment.inactivityDays || 7}+ day break
- Acknowledge the break without judgment
- Suggest starting at 70-80% of previous loads
- Focus on rebuilding momentum`;
    
    default:
      return '';
  }
};

// Prompt variant selection
export const selectPromptVariant = (userId: string, sessionId: string, segment: UserSegment): PromptVariant => {
  const variants = getVariantsForSegment(segment);
  const hash = simpleHash(userId + sessionId);
  return variants[hash % variants.length];
};

const getVariantsForSegment = (segment: UserSegment): PromptVariant[] => {
  // Define variants based on segment
  const baseVariants: PromptVariant[] = [
    { id: 'v1', tone: 'trainer_friend', memoryLoad: 'full', loggingOffer: 'metric_detected', safetyLevel: 'short' },
    { id: 'v2', tone: 'strict_coach', memoryLoad: 'summary', loggingOffer: 'metric_detected', safetyLevel: 'short' },
    { id: 'v3', tone: 'science_nerd', memoryLoad: 'full', loggingOffer: 'metric_detected', safetyLevel: 'detailed' },
    { id: 'v4', tone: 'trainer_friend', memoryLoad: 'recent_only', loggingOffer: 'always', safetyLevel: 'contextual' }
  ];
  
  // Customize based on segment
  if (segment.type === 'beginner') {
    return baseVariants.filter(v => v.tone === 'trainer_friend' && v.safetyLevel !== 'short');
  } else if (segment.type === 'advanced') {
    return baseVariants.filter(v => v.tone !== 'trainer_friend');
  }
  
  return baseVariants;
};

const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Export function to compute user segment
export const computeUserSegment = (user: any): UserSegment => {
  const weeksSinceStart = user.createdAt ? 
    Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 7)) : 0;
  
  const lastActivityDays = user.lastActivityAt ?
    Math.floor((Date.now() - new Date(user.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  // Check if returning user
  if (lastActivityDays && lastActivityDays >= 10) {
    return { type: 'returning', inactivityDays: lastActivityDays };
  }
  
  // Categorize by experience
  if (weeksSinceStart < 4) {
    return { type: 'beginner', minWeeks: 0, maxWeeks: 4 };
  } else if (weeksSinceStart < 26) {
    return { type: 'intermediate', minWeeks: 4, maxWeeks: 26 };
  } else {
    const prCount = user.personalRecords?.length || 0;
    const prFrequency = prCount / Math.max(weeksSinceStart, 1);
    return { type: 'advanced', minWeeks: 26, prFrequency };
  }
};