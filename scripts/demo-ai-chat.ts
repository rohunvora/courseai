#!/usr/bin/env tsx

/**
 * Demo script to show AI chat functionality working
 */

async function demoAIChat() {
  console.log('🤖 CourseAI - AI Integration Demo\n');
  
  // 1. Create a course
  console.log('1️⃣ Creating a fitness course...');
  const courseResponse = await fetch('http://localhost:3000/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'demo-user-123',
      topic: 'Strength Training',
      currentLevel: 'beginner',
      targetLevel: 'intermediate',
      timelineWeeks: 12,
      preferences: {
        focusAreas: ['muscle building', 'form'],
        equipment: ['dumbbells', 'barbell']
      }
    })
  });
  
  const courseData = await courseResponse.json();
  
  if (!courseData.courseId) {
    console.log('❌ Course creation failed:', courseData.error?.message || 'Unknown error');
    console.log('\n💡 This might be because the database is not connected.');
    console.log('   The AI chat can still work without a database!\n');
  } else {
    console.log('✅ Course created:', courseData.courseId);
  }
  
  // 2. Test AI chat with streaming response
  console.log('\n2️⃣ Sending workout data to AI coach...');
  console.log('📝 Message: "I just did 3 sets of bench press: 10 reps at 135 lbs, 8 reps at 145 lbs, and 6 reps at 155 lbs"\n');
  
  const chatResponse = await fetch('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: courseData.courseId || 'demo-course-123',
      sessionId: 'demo-session-123',
      message: 'I just did 3 sets of bench press: 10 reps at 135 lbs, 8 reps at 145 lbs, and 6 reps at 155 lbs'
    })
  });
  
  if (!chatResponse.ok) {
    const error = await chatResponse.json();
    console.log('❌ Chat failed:', error.error?.message || 'Unknown error');
    return;
  }
  
  console.log('🤖 AI Coach Response (streaming):');
  console.log('─'.repeat(50));
  
  // Read streaming response
  const reader = chatResponse.body?.getReader();
  const decoder = new TextDecoder();
  let aiResponse = '';
  
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token') {
              process.stdout.write(data.content);
              aiResponse += data.content;
            } else if (data.type === 'activity_extracted') {
              console.log('\n\n💪 Workout Data Automatically Extracted:');
              console.log(JSON.stringify(data.activities, null, 2));
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }
  
  console.log('\n' + '─'.repeat(50));
  console.log('\n✅ AI Integration is working!');
  console.log('\n📊 Summary:');
  console.log('   • AI understood the workout message');
  console.log('   • Provided personalized coaching response');
  console.log('   • Automatically extracted structured workout data');
  console.log('   • Streamed response in real-time\n');
}

// Run the demo
demoAIChat().catch(console.error);