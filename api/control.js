import supabase from './_supabase.js';

const VALID_ACTIONS = new Set([
  'pump_on',
  'pump_off',
  'pump_10s',
  'led_on',
  'led_off',
  'mode_auto',
  'mode_manual',
  'wifi_update',
]);

function resolveTopic(action) {
  switch (action) {
    case 'pump_on':
    case 'pump_off':
    case 'pump_10s':
      return action === 'pump_10s' ? 'sproutai/ai/action' : 'sproutai/pompa/cmd';
    case 'led_on':
    case 'led_off':
      return 'sproutai/lampu/cmd';
    case 'mode_auto':
    case 'mode_manual':
      return 'sproutai/mode/cmd';
    case 'wifi_update':
      return 'sproutai/wifi/cmd';
    default:
      return null;
  }
}

function buildPayload({ id, action, device, duration, data }) {
  const payload = {
    command_id: id,
    action,
    device,
    duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    issued_at: new Date().toISOString(),
    source: 'web',
  };

  if (action === 'wifi_update') {
    payload.ssid = String(data?.ssid || '').trim();
    payload.password = String(data?.password || '');
  }

  if (action === 'pump_10s') {
    payload.duration = typeof duration === 'number' && duration > 0 ? duration : 10;
  }

  return payload;
}

async function insertLog({ action, device, duration }) {
  const executedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('control_logs')
    .insert({
      action,
      device,
      duration: duration ?? null,
      status: 'pending',
      executed_at: executedAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { limit = 50 } = req.query;
      const { data, error } = await supabase
        .from('control_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(Math.max(1, Math.min(200, parseInt(limit, 10) || 50)));

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || '').trim();
      const device = String(body.device || 'ESP32_001').trim() || 'ESP32_001';
      const duration = body.duration === undefined || body.duration === null || body.duration === ''
        ? null
        : Number(body.duration);
      const data = body.data || {};

      if (!VALID_ACTIONS.has(action)) {
        return res.status(400).json({ error: `Invalid action: ${action}` });
      }

      if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) {
        return res.status(400).json({ error: 'Duration must be a positive number' });
      }

      const log = await insertLog({ action, device, duration });
      const topic = resolveTopic(action);
      const payload = buildPayload({ id: log.id, action, device, duration, data });

      await supabase.from('activity_logs').insert({
        type: 'control',
        message: `Queued ${action} for ${device}`,
        details: { action, device, duration, command_id: log.id },
        created_at: new Date().toISOString(),
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        command_id: log.id,
        topic,
        payload,
        payload_json: JSON.stringify(payload),
        log,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Control API error:', err);
    res.status(500).json({ error: err.message || 'Control API error' });
  }
}
