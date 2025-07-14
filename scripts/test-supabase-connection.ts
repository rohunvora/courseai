import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'Not set');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Basic connection
    console.log('\n1. Testing basic connection...');
    const { data: healthCheck, error: healthError } = await supabase.from('users').select('count').limit(1);
    if (healthError) {
      console.error('❌ Basic connection failed:', healthError);
    } else {
      console.log('✅ Basic connection successful');
    }

    // Test 2: Auth status
    console.log('\n2. Testing auth status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.log('ℹ️  No authenticated user (this is normal if not logged in)');
    } else {
      console.log('✅ Auth check successful, user:', user?.email || 'No user');
    }

    // Test 3: List tables
    console.log('\n3. Checking available tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('courses')
      .select('*')
      .limit(1);
    
    if (tablesError) {
      console.error('❌ Error accessing courses table:', tablesError);
    } else {
      console.log('✅ Successfully accessed courses table');
    }

    // Test 4: Check RLS policies
    console.log('\n4. Testing Row Level Security...');
    const { count, error: countError } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ RLS check failed:', countError);
    } else {
      console.log(`✅ RLS check successful, courses count: ${count}`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testConnection().then(() => {
  console.log('\n✅ Connection test complete');
}).catch((error) => {
  console.error('\n❌ Connection test failed:', error);
  process.exit(1);
});