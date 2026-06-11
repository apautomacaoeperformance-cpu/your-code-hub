import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewoukrtcsthxmczgdvza.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3b3VrcnRjc3RoeG1jemdkdnphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTIwODgsImV4cCI6MjA5NjE4ODA4OH0.QxxCg_DReNjw7x_TvjSUgfkOW0fgmO62KeYSTlMcl2E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});