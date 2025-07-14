#!/usr/bin/env tsx

/**
 * Test workout data extraction directly
 */

import dotenv from 'dotenv';
import { OpenAIService } from '../src/services/openai.js';

dotenv.config();

async function testExtraction() {
  console.log('💪 Testing Workout Data Extraction\n');
  
  const openai = new OpenAIService();
  
  const workoutMessage = `
    Today's workout was intense! Here's what I did:
    - Bench press: 3 sets - 10 reps at 135 lbs, 8 reps at 145 lbs, 6 reps at 155 lbs
    - Dumbbell rows: 4 sets of 12 reps with 50 lb dumbbells
    - Squats: 5 sets of 5 reps at 225 lbs
    - Pull-ups: 3 sets of 8 reps (bodyweight)
    - Planks: 3 sets of 60 seconds each
  `;
  
  console.log('📝 Input message:');
  console.log(workoutMessage);
  console.log('\n' + '─'.repeat(70) + '\n');
  
  try {
    console.log('🔍 Extracting workout data...\n');
    const activities = await openai.extractActivityData(workoutMessage, 'workout');
    
    console.log('📊 Extracted Activities:\n');
    console.log(JSON.stringify(activities, null, 2));
    
    console.log('\n✅ Extraction Summary:');
    
    if (activities && typeof activities === 'object') {
      const data = (activities as any).data || [];
      console.log(`   • Found ${data.length} different exercises`);
      console.log(`   • Activity type: ${(activities as any).activityType}`);
      
      data.forEach((activity: any) => {
        const repsInfo = Array.isArray(activity.reps) 
          ? activity.reps.join(', ') 
          : activity.reps;
        
        const weightInfo = Array.isArray(activity.weight)
          ? activity.weight.join(', ')
          : activity.weight;
          
        console.log(`   • ${activity.exercise}: ${activity.sets} sets × ${repsInfo} reps @ ${weightInfo}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Extraction failed:', error);
  }
}

testExtraction().catch(console.error);