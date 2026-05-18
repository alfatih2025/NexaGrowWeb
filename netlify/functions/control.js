import supabase from './_supabase.js';

const COMMAND_MAP = {
  pump_on: { topic: 'sproutai/pompa/cmd', payload: 'ON' },
  pump_off: { topic: 'sproutai/pompa/cmd', payload: 'OFF' },
  pump_10s: (duration, commandId) => ({
    topic: 'sproutai/ai/action',
    payload: JSON.stringify({
      command_id: commandId,
      action: 'pump_10s',
      pump: 'ON',
      duration: Number(duration || 10),
    }),
  }),
  led_on: { topic: 'sproutai/lampu/cmd', payload: 'ON' },
  led_off: { topic: 'sproutai/lampu/cmd', payload: 'OFF' },
  mode_auto: { topic: 'sproutai/mode/cmd', payload: 'AUTO' },
  mode_manual: { topic: 'sproutai/mode/cmd', payload: 'MANUAL' },
  wifi_update: (data, commandId) => ({
    topic: 'sproutai/wifi/cmd',
    payload: JSON.stringify({
      command_id: commandId,
      ssid: String(data?.ssid || '').trim(),
      password: String(data?.password || ''),
    }),
  }),
};

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
  if (!supabase) return json(500, { error: 'Supabase belum dikonfigurasi' });

  try {
    if (event.httpMethod === 'GET') {
      const limit = Math.min(Number(event.queryStringParameters?.limit ?? 50) || 50, 200);
      const { data, error } = await supabase
        .from('control_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return json(200, data || []);
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const action = String(body.action || '').trim();
      const device = String(body.device || 'ESP32_001').trim();
      const duration = body.duration ?? null;
      const data = body.data || null;

      if (!Object.keys(COMMAND_MAP).includes(action)) {
        return json(400, { error: 'Invalid action' });
      }

      const now = new Date().toISOString();
      const { data: row, error } = await supabase
        .from('control_logs')
        .insert({
          action,
          device,
          duration: duration === null || duration === undefined || duration === '' ? null : Number(duration),
          status: 'pending',
          executed_at: now,
        })
        .select('*')
        .single();

      if (error) throw error;

      const resolved = typeof COMMAND_MAP[action] === 'function'
        ? COMMAND_MAP[action](duration, row.id, data)
        : COMMAND_MAP[action];

      await supabase.from('activity_logs').insert({
        type: 'control',
        message: `Command ${action} queued for ${device}`,
        details: { action, device, duration, command_id: row.id },
      }).catch(() => {});

      return json(200, {
        success: true,
        command_id: row.id,
        status: row.status,
        topic: resolved.topic,
        payload: resolved.payload,
        action,
        device,
        duration: row.duration,
      });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Control API error' });
  }
}
