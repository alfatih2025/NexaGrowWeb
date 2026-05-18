import { createClient } from '@supabase/supabase-js';

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

const SUPABASE_URL = readEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const SUPABASE_KEY = readEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Supabase env is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabase;
}

export default supabase;
