import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase configuration
// These values can be safely public (anon key is limited by RLS policies)
const SUPABASE_URL = window.SUPABASE_URL || 'https://jceuijuzfjfdnyrxvqny.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZXVpanV6ZmpmZG55cnh2cW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDExOTEsImV4cCI6MjA5NzY3NzE5MX0.h-jjY8qu5KbCR0zYr6xkmVO8GIajkhB5ZXZ0-2UBecw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;

// Admin emails — keep existing admin list here
export const ADMIN_EMAILS = ["admin@grandskyairways.com", "michaelabath83@gmail.com"];

// Note: ensure a `profiles` table exists in your Supabase project to store user profiles.
