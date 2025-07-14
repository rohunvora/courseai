// Demo of the working Courses AI brain
require('dotenv').config();
const { Client } = require('pg');
const OpenAI = require('openai');

const db = new Client({
  connectionString: process.env.DATABASE_URL
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function demo() {
  console.log('🧠 Courses AI Brain Demo\n');
  
  // Connect to database
  await db.connect();
  console.log('✅ Database connected');
  
  // 1. Create a course
  console.log('\n1. Creating a course...');
  const courseResult = await db.query(`
    INSERT INTO courses (user_id, title, topic, current_level, status)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Strength Training Course', 'Strength Training', 'beginner', 'active')
    RETURNING id, title, topic
  `);
  const courseId = courseResult.rows[0].id;
  console.log(`✅ Created course: ${courseResult.rows[0].title} (${courseId})`);
  
  // 2. Generate a curriculum
  console.log('\n2. Generating curriculum with AI...');
  const curriculumPrompt = `Create a structured course outline for: "Strength Training" at beginner level.
  
Return a JSON object with this structure:
{
  "title": "Course Title", 
  "description": "Brief description",
  "estimatedWeeks": 8,
  "modules": [
    {
      "id": "module-1",
      "title": "Module Title",
      "description": "Module description",
      "estimatedHours": 4,
      "lessons": [
        {
          "id": "lesson-1", 
          "title": "Lesson Title",
          "type": "lesson",
          "estimatedMinutes": 30
        }
      ]
    }
  ]
}`;

  const curriculumResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: curriculumPrompt }],
    response_format: { type: 'json_object' }
  });
  
  const curriculum = JSON.parse(curriculumResponse.choices[0].message.content);
  console.log(`✅ Generated curriculum: ${curriculum.title}`);
  console.log(`   - ${curriculum.modules.length} modules`);
  console.log(`   - Estimated duration: ${curriculum.estimatedWeeks} weeks`);
  
  // Save curriculum
  await db.query(`
    INSERT INTO curriculum (course_id, structure, version)
    VALUES ($1, $2, 1)
  `, [courseId, JSON.stringify(curriculum)]);
  console.log(`✅ Saved curriculum to database`);
  
  // 3. Start a session
  console.log('\n3. Starting a practice session...');
  const sessionResult = await db.query(`
    INSERT INTO sessions (user_id, course_id, session_type, planned_duration, status)
    VALUES ('00000000-0000-0000-0000-000000000001', $1, 'practice', 60, 'active')
    RETURNING id
  `, [courseId]);
  const sessionId = sessionResult.rows[0].id;
  console.log(`✅ Started session: ${sessionId}`);
  
  // 4. Simulate a chat conversation
  console.log('\n4. Simulating AI coaching conversation...');
  const chatPrompt = `You are an AI fitness coach. A user just said: "I did 3 sets of bench press at 135lbs with 8, 7, 6 reps. How did I do?"
  
Respond encouragingly and give brief advice. Keep it under 100 words.`;

  const chatResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: chatPrompt }],
    max_tokens: 150
  });
  
  const aiReply = chatResponse.choices[0].message.content;
  console.log(`💬 User: "I did 3 sets of bench press at 135lbs with 8, 7, 6 reps. How did I do?"`);
  console.log(`🤖 AI Coach: "${aiReply}"`);
  
  // Save chat to database
  await db.query(`
    INSERT INTO chat_history (course_id, session_id, message_type, content)
    VALUES ($1, $2, 'user', 'I did 3 sets of bench press at 135lbs with 8, 7, 6 reps. How did I do?'),
           ($1, $2, 'assistant', $3)
  `, [courseId, sessionId, aiReply]);
  console.log(`✅ Saved conversation to database`);
  
  // 5. Auto-extract and log progress
  console.log('\n5. Auto-extracting workout data...');
  const extractPrompt = `Extract workout data from: "I did 3 sets of bench press at 135lbs with 8, 7, 6 reps."
  
Return JSON: {"exercise": "bench_press", "weight": "135lbs", "sets": 3, "reps": [8, 7, 6]}`;

  const extractResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: extractPrompt }],
    response_format: { type: 'json_object' }
  });
  
  const workoutData = JSON.parse(extractResponse.choices[0].message.content);
  console.log(`✅ Extracted: ${workoutData.exercise} - ${workoutData.weight} x ${workoutData.sets} sets`);
  
  // Calculate volume
  const totalReps = workoutData.reps.reduce((a, b) => a + b, 0);
  const volume = parseInt(workoutData.weight) * totalReps;
  
  // Save progress log
  await db.query(`
    INSERT INTO progress_logs (user_id, course_id, session_id, activity_type, data, metrics)
    VALUES ('00000000-0000-0000-0000-000000000001', $1, $2, 'exercise', $3, $4)
  `, [courseId, sessionId, JSON.stringify(workoutData), JSON.stringify({ volume, totalReps })]);
  console.log(`✅ Logged progress: ${volume} total volume (${totalReps} reps)`);
  
  // 6. Show summary
  console.log('\n📊 Session Summary:');
  const summary = await db.query(`
    SELECT COUNT(*) as log_count, 
           COUNT(DISTINCT activity_type) as activity_types
    FROM progress_logs 
    WHERE session_id = $1
  `, [sessionId]);
  
  console.log(`   - ${summary.rows[0].log_count} activities logged`);
  console.log(`   - ${summary.rows[0].activity_types} different activity types`);
  
  await db.end();
  console.log('\n🎉 Brain demo complete! Core functionality working:');
  console.log('   ✅ Course creation');
  console.log('   ✅ AI curriculum generation');
  console.log('   ✅ Session management');
  console.log('   ✅ Intelligent conversation');
  console.log('   ✅ Auto activity extraction');
  console.log('   ✅ Progress tracking');
  console.log('\n🚀 Ready to build the frontend!');
}

demo().catch(console.error);