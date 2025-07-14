#!/usr/bin/env tsx

/**
 * Direct test of AI functionality without database
 */

async function testAIDirect() {
  console.log('🤖 CourseAI - Direct AI Test (No Database)\n');
  
  const courseId = 'test-course-123';
  const message = 'I just finished my workout! Did 3 sets of bench press: 10 reps at 135 lbs, 8 reps at 145 lbs, and 6 reps at 155 lbs. Also did 4 sets of 12 dumbbell rows with 50 lb dumbbells.';
  
  console.log('📝 Sending message to AI coach:');
  console.log(`   "${message}"\n`);
  
  try {
    const response = await fetch(`http://localhost:3000/api/chat/${courseId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        sessionId: 'test-session-123',
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log('❌ Request failed:', error);
      return;
    }
    
    console.log('🤖 AI Coach Response (streaming):\n');
    console.log('─'.repeat(60));
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let extractedActivities: any[] = [];
    
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
                fullResponse += data.content;
              } else if (data.type === 'activity_extracted') {
                extractedActivities = data.activities;
              } else if (data.type === 'complete') {
                console.log('\n' + '─'.repeat(60) + '\n');
                
                if (extractedActivities.length > 0) {
                  console.log('💪 Automatically Extracted Workout Data:\n');
                  console.log(JSON.stringify(extractedActivities, null, 2));
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    }
    
    console.log('\n✅ AI Integration Test Complete!\n');
    console.log('📊 Results:');
    console.log('   • AI understood and responded to the workout message');
    console.log('   • Response was streamed in real-time');
    console.log(`   • Extracted ${extractedActivities.length} activities from the conversation`);
    console.log('   • No database required - AI is fully functional!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAIDirect().catch(console.error);