import { createClient } from '@supabase/supabase-js'

// Get environment variables with fallbacks for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Only create client if we have the required config
let supabase: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('Supabase configuration missing. Authentication features will be disabled.')
}

export { supabase }

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null
}

// Safe auth operations that handle missing config
export const authOperations = {
  async signUp(email: string, password: string, metadata?: any) {
    if (!supabase) throw new Error('Supabase not configured')
    return supabase.auth.signUp({ email, password, options: { data: metadata } })
  },

  async signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase not configured')
    return supabase.auth.signInWithPassword({ email, password })
  },

  async signOut() {
    if (!supabase) throw new Error('Supabase not configured')
    return supabase.auth.signOut()
  },

  async getUser() {
    if (!supabase) throw new Error('Supabase not configured')
    return supabase.auth.getUser()
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
    return supabase.auth.onAuthStateChange(callback)
  }
}