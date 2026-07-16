import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './_wake.js';
import { readEnv } from './_env.js';

const SUPABASE_URL = readEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_KEY = readEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
);

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        fetch: async (url, options) => {
          const res = await fetch(url, options);
          if (!res.ok && res.status >= 500) triggerRestore();
          return res;
        },
      },
    })
  : null;

export default supabase;
