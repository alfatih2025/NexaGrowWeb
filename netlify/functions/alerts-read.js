import supabase from './_supabase.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!supabase) return json(200, { markedAsRead: 0 });

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const id = body.id ? Number(body.id) : null;

    if (id) {
      const { data, error } = await supabase
        .from('alerts')
        .update({ read: true })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return json(200, data);
    }

    const { data, error } = await supabase
      .from('alerts')
      .update({ read: true })
      .eq('read', false)
      .select('*');

    if (error) throw error;
    return json(200, { markedAsRead: data?.length || 0 });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Alert read error' });
  }
}
