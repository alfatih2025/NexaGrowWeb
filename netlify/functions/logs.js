import supabase from './_supabase.js';
import { requireApiAuth, authError } from './_auth.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!supabase) return json(500, { error: 'Supabase belum dikonfigurasi' });

  try {
    if (event.httpMethod === 'GET') {
      if (!requireApiAuth(event)) return authError();

      const type = event.queryStringParameters?.type;
      const limit = Math.min(Number(event.queryStringParameters?.limit ?? 100) || 100, 500);

      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (type) query = query.eq('type', type);

      const { data, error } = await query;
      if (error) throw error;
      return json(200, data || []);
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Logs error' });
  }
}
