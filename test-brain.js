// Quick test of the brain without starting the full server
require('dotenv').config();
const { Client } = require('pg');

async function testDB() {
  console.log('🧪 Testing database connection...');
  const client = new Client({
    connectionString: 'postgresql://localhost:5432/courseai'
  });
  
  try {
    await client.connect();
    console.log('✅ Database connected');
    
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`✅ Found ${result.rows[0].count} users`);
    
    await client.end();
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

async function testOpenAI() {
  console.log('🧪 Testing OpenAI connection...');
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say "Hello from OpenAI!"' }],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ OpenAI error:', error.message);
  }
}

async function main() {
  console.log('🚀 Testing Courses AI Brain Components\n');
  
  await testDB();
  console.log('');
  await testOpenAI();
  console.log('');
  console.log('🎉 Basic tests complete!');
}

main().catch(console.error);