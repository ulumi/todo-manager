// ════════════════════════════════════════════════════════
//  SUPABASE — init client
// ════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://ztibrrmebnpzmflzghjb.supabase.co';
// Clé PUBLISHABLE (sb_publishable_…), pas la clé anon JWT historique.
// Publique par conception, exactement comme l'anon : c'est RLS qui protège,
// pas le secret de cette valeur — la commiter n'est donc pas une régression.
// Le changement sert à pouvoir DÉSACTIVER les clés JWT legacy côté Supabase :
// elles vont par paire (anon + service_role), et c'est la service_role de
// cette paire qui a fuité pendant 143 jours dans ce dépôt public. Tant que le
// front dépendait de l'anon legacy, la couper aurait cassé l'app.
const SUPABASE_KEY = 'sb_publishable_8bm28Lm-gQBEFJ948KfLrg_wnz1oXtG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
