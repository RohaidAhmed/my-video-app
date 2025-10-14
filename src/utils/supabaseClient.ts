import { createClient } from '@supabase/supabase-js';

// Ensure the environment variables are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key environment variables');
}

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);