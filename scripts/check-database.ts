#!/usr/bin/env tsx

/**
 * Database inspection utility for CourseAI
 * Lists all tables and their structure in the Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 CourseAI Database Inspector\n');

  // List of expected CourseAI tables
  const expectedTables = [
    'users',
    'courses', 
    'sessions',
    'chat_history',
    'progress_logs',
    'curriculum',
    'user_memory'
  ];

  console.log('📋 Checking CourseAI tables:\n');
  
  let foundTables = 0;
  
  for (const table of expectedTables) {
    try {
      // Try to query the table
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table.padEnd(15)} - exists (${count ?? 0} rows)`);
        foundTables++;
      } else if (error.code === '42P01') {
        console.log(`❌ ${table.padEnd(15)} - does not exist`);
      } else {
        console.log(`⚠️  ${table.padEnd(15)} - ${error.message}`);
      }
    } catch (e) {
      console.log(`❌ ${table.padEnd(15)} - error checking table`);
    }
  }

  console.log(`\n📊 Summary: ${foundTables}/${expectedTables.length} tables found`);

  if (foundTables === 0) {
    console.log('\n❌ No tables found. Run: npm run setup:database');
  } else if (foundTables < expectedTables.length) {
    console.log('\n⚠️  Some tables are missing. Run: npm run setup:database');
  } else {
    console.log('\n✅ All CourseAI tables are present!');
  }

  // Additional info
  console.log('\n📍 Database URL:', supabaseUrl);
  console.log('🔑 Using key:', supabaseKey.substring(0, 20) + '...');
}

checkDatabase().catch((error) => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});