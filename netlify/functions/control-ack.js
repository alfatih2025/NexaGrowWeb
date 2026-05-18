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
  if (!supabase) return json(500, { error: 'Supabase belum dikonfigurasi' });

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const command_id = Number(body.command_id);
    const status = String(body.status || 'completed');
    const detail = String(body.detail || '').trim();

    if (!Number.isFinite(command_id)) {
      return json(400, { error: 'command_id is required' });
    }

    const updatePayload = {
      status,
      executed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('control_logs')
      .update(updatePayload)
      .eq('id', command_id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    await supabase.from('activity_logs').insert({
      type: 'control_ack',
      message: detail || `Command ${command_id} acknowledged as ${status}`,
      details: { command_id, status, detail },
    }).catch(() => {});

    return json(200, {
      success: true,
      command_id,
      status,
      updated: data || null,
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Control ACK error' });
  }
}
