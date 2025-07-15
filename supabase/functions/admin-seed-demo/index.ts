import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check admin token
    const authHeader = req.headers.get('Authorization')
    const adminToken = Deno.env.get('ADMIN_TOKEN')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.substring(7)
    if (token !== adminToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid admin token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Clear existing demo data
    await supabase.from('progress_logs').delete().in('user_id', ['demo-user-1', 'demo-user-2'])
    await supabase.from('user_memory').delete().in('user_id', ['demo-user-1', 'demo-user-2'])
    await supabase.from('sessions').delete().in('user_id', ['demo-user-1', 'demo-user-2'])
    await supabase.from('courses').delete().in('user_id', ['demo-user-1', 'demo-user-2'])
    await supabase.from('users').delete().in('email', ['demo@example.com', 'test@example.com'])

    // Create demo users
    const { data: demoUser } = await supabase.auth.admin.createUser({
      email: 'demo@example.com',
      password: 'demo123',
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo',
        last_name: 'User'
      }
    })

    const { data: testUser } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test123',
      email_confirm: true,
      user_metadata: {
        first_name: 'Test',
        last_name: 'User'
      }
    })

    // Create demo courses and data...
    // (Similar to the Node.js version but using Supabase client)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Demo data seeded successfully',
        data: {
          users: [
            { email: 'demo@example.com', password: 'demo123' },
            { email: 'test@example.com', password: 'test123' }
          ]
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})