import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';

async function createDemoUser() {
  try {
    console.log('Creating demo user...');
    
    const demoUser = await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@courseai.com',
      username: 'demo',
      passwordHash: 'demo', // In real app, this would be hashed
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    console.log('✅ Demo user created:', demoUser[0]);
    process.exit(0);
  } catch (error: any) {
    if (error.code === '23505') {
      console.log('ℹ️ Demo user already exists');
      process.exit(0);
    }
    console.error('❌ Error creating demo user:', error.message);
    process.exit(1);
  }
}

createDemoUser();