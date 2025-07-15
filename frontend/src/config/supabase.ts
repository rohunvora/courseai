// Supabase Edge Functions configuration

// Get the Supabase URL from environment or use the project URL
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wwnbcnslkdupmuofqmey.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
    const error = await response.json();
    throw new Error(error.error?.message || error.error || 'Edge function error');
  }

  return response.json();
}