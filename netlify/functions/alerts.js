import supabase from './_supabase.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!supabase) return json(200, []);

  try {
    if (event.httpMethod === 'GET') {
      const unread = String(event.queryStringParameters?.unread ?? 'false') === 'true';
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (unread) query = query.eq('read', false);
      const { data, error } = await query;
      if (error) throw error;
      return json(200, data || []);
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { type, message, severity = 'info', read = false } = body;
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          type,
          message,
          severity,
          read,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return json(201, data);
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Alerts API error' });
  }
}
