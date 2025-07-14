#!/usr/bin/env tsx

/**
 * Supabase Database Setup Script
 * 
 * This script provides instructions for setting up the CourseAI database schema
 * in Supabase. Since Supabase requires SQL to be executed via their dashboard
 * for security reasons, this script guides you through the process.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate configuration
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_ANON_KEY are required');
  process.exit(1);
}

// Extract project reference from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

async function checkDatabaseStatus() {
  console.log('🚀 CourseAI Database Setup Assistant\n');
  console.log(`📍 Project: ${projectRef}`);
  console.log(`🔗 URL: ${supabaseUrl}\n`);

  // Use service key if available, otherwise anon key
  const authKey = supabaseServiceKey || supabaseKey;
  const supabase = createClient(supabaseUrl, authKey);

  // Check which tables exist
  console.log('🔍 Checking current database status...\n');
  
  const requiredTables = [
    'users',
    'courses',
    'sessions',
    'chat_history',
    'progress_logs',
    'curriculum',
    'user_memory'
  ];
  
  let existingTables = 0;
  const missingTables: string[] = [];
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('count(*)').limit(1);
      
      if (!error) {
        console.log(`✅ Table '${table}' exists`);
        existingTables++;
      } else if (error.code === '42P01') {
        console.log(`❌ Table '${table}' does not exist`);
        missingTables.push(table);
      } else {
        console.log(`⚠️  Table '${table}' status unclear: ${error.message}`);
        missingTables.push(table);
      }
    } catch (e) {
      console.log(`❌ Table '${table}' does not exist`);
      missingTables.push(table);
    }
  }

  console.log(`\n📊 Status: ${existingTables}/${requiredTables.length} tables exist`);

  if (existingTables === requiredTables.length) {
    console.log('\n🎉 All tables already exist! Your database is ready.');
    console.log('\n✨ Next steps:');
    console.log('   1. Run the development server: npm run dev');
    console.log('   2. Start the frontend: cd frontend && npm run dev');
    console.log('   3. Or use: ./dev-start.sh to run everything\n');
    return;
  }

  // Provide setup instructions
  console.log('\n📋 Setup Instructions:\n');
  console.log('Since Supabase requires SQL execution via their dashboard, please follow these steps:\n');
  
  console.log('1. 🌐 Open the Supabase SQL Editor:');
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log(`   (or ${supabaseUrl.replace('.co', '.co/project/default/sql')})\n`);
  
  console.log('2. 📄 Copy the SQL schema from:');
  console.log(`   ${path.join(process.cwd(), 'generated/20250714_1625/sql/001_initial_schema.sql')}\n`);
  
  console.log('3. 📋 Paste the entire SQL content into the editor\n');
  
  console.log('4. ▶️  Click "Run" to execute the SQL\n');
  
  console.log('5. ✅ Once complete, run this script again to verify\n');

  if (missingTables.length > 0) {
    console.log('⚠️  Missing tables:', missingTables.join(', '));
  }

  // Check if SQL file exists
  const sqlPath = path.join(process.cwd(), 'generated/20250714_1625/sql/001_initial_schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('\n❌ SQL schema file not found at:', sqlPath);
    console.error('   Please ensure the schema file exists before proceeding.');
  } else {
    console.log('\n✅ SQL schema file found and ready to use');
  }
}

// Run the setup assistant
checkDatabaseStatus().catch((error) => {
  console.error('\n❌ Setup error:', error);
  process.exit(1);
});