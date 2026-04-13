// ════════════════════════════════════════════════════════
//  SUPABASE — init client
// ════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://ztibrrmebnpzmflzghjb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWJycm1lYm5wem1mbHpnaGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzcxODAsImV4cCI6MjA4ODI1MzE4MH0.Qe0fFvwZWZWyBgYzG1rrlTMO6fnfrCxhQ9Z5CkJTEak';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
