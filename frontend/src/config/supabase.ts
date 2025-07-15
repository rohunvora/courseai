// Supabase Edge Functions configuration

// Get the Supabase URL from environment or use the project URL
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wwnbcnslkdupmuofqmey.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bmJjbnNsa2R1cG11b2ZxbWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MjYyMzMsImV4cCI6MjA2ODEwMjIzM30.7IJQi4M8QpDF807h2HV8wEsmO9UdRXerxpHKI5vnbKc';

// Edge Function endpoints
export const EDGE_FUNCTIONS = {
  createCourse: `${SUPABASE_URL}/functions/v1/create-course`,
  createSession: `${SUPABASE_URL}/functions/v1/create-session`,
  chatMessage: `${SUPABASE_URL}/functions/v1/chat-message`,
  seedDemo: `${SUPABASE_URL}/functions/v1/admin-seed-demo`,
  getProgress: `${SUPABASE_URL}/functions/v1/get-progress`,
};

// Helper to make Edge Function calls
export async function callEdgeFunction(functionName: keyof typeof EDGE_FUNCTIONS, data: any, options?: { adminToken?: string }) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };

  if (options?.adminToken) {
    headers['x-admin-token'] = options.adminToken;
  }

  const response = await fetch(EDGE_FUNCTIONS[functionName], {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Edge function error: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.error?.message || error.error || errorMessage;
    } catch (e) {
      // If response isn't JSON, use status text
      errorMessage = `${response.status} ${response.statusText}`;
    }
    console.error('Edge function call failed:', errorMessage);
    throw new Error(errorMessage);
  }

  return response.json();
}