import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL\!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY\!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPgVector() {
  console.log('🔍 Checking pgvector extension...\n');

  try {
    // Check if pgvector extension is installed
    const { data: extensions, error } = await supabase
      .rpc('pg_available_extensions')
      .eq('name', 'vector');

    if (error) {
      // Try a simpler query
      const { data, error: err2 } = await supabase.from('user_memory').select('id').limit(1);
      if (err2) {
        console.error('❌ Error checking extensions:', err2.message);
      } else {
        console.log('✅ user_memory table exists and is accessible');
      }
    } else if (extensions && extensions.length > 0) {
      console.log('✅ pgvector extension is available');
      console.log('  Version:', extensions[0].default_version);
    } else {
      console.log('❌ pgvector extension not found');
    }

    // Check if vector column exists
    const { data: columnCheck, error: colError } = await supabase
      .from('user_memory')
      .select('embedding')
      .limit(0);

    if (\!colError) {
      console.log('✅ embedding column exists in user_memory table');
    } else {
      console.log('❌ embedding column not found:', colError.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkPgVector().catch(console.error);
