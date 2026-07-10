import supabase from '../src/lib/apiHelpers/_supabase.js';
import { requireApiAuth, authError } from '../src/lib/apiHelpers/_auth.js';

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
  settings_sync: (data, commandId) => ({
    topic: 'sproutai/settings/cmd',
    payload: JSON.stringify({
      command_id: commandId,
      plant_phase: String(data?.plant_phase || '').trim(),
      location: String(data?.location || '').trim(),
      temp_threshold_low: Number(data?.temp_threshold_low ?? 0),
      temp_threshold_high: Number(data?.temp_threshold_high ?? 0),
      humidity_threshold_low: Number(data?.humidity_threshold_low ?? 0),
      humidity_threshold_high: Number(data?.humidity_threshold_high ?? 0),
      soil_threshold_low: Number(data?.soil_threshold_low ?? 0),
      soil_threshold_high: Number(data?.soil_threshold_high ?? 0),
      soil_threshold_critical: Number(data?.soil_threshold_critical ?? 0),
      watering_time: String(data?.watering_time || '').trim(),
      watering_duration: Number(data?.watering_duration ?? 10),
      watering_enabled: Boolean(data?.watering_enabled ?? true),
      auto_report: Boolean(data?.auto_report ?? true),
      report_time: String(data?.report_time || '08:00').trim(),
      user_name: String(data?.user_name || '').trim(),
      user_email: String(data?.user_email || '').trim(),
    }),
  }),
  schedule_set: (data, commandId) => ({
    topic: 'sproutai/schedule/cmd',
    payload: JSON.stringify({
      command_id: commandId,
      watering_time: String(data?.watering_time || '').trim(),
      watering_duration: Number(data?.watering_duration || 10),
      schedule_enabled: Boolean(data?.schedule_enabled ?? true),
    }),
  }),
  wifi_update: (data, commandId) => ({
    topic: 'sproutai/wifi/cmd',
    payload: JSON.stringify({
      command_id: commandId,
      ssid: String(data?.ssid || '').trim(),
      password: String(data?.password || ''),
    }),
  }),
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!supabase) return res.status(500).json({ error: 'Supabase belum dikonfigurasi' });

  try {
    if (req.method === 'GET') {
      const { limit = 50 } = req.query;
      const { data, error } = await supabase
        .from('control_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(Math.min(Number(limit) || 50, 200));

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      if (!requireApiAuth(req, res)) return;

      const body = req.body || {};
      const action = String(body.action || '').trim();
      const device = String(body.device || 'ESP32_001').trim();
      const duration = body.duration ?? null;
      const data = body.data || null;

      if (!Object.keys(COMMAND_MAP).includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
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
        ? COMMAND_MAP[action](data ?? duration, row.id)
        : COMMAND_MAP[action];

      await supabase.from('activity_logs').insert({
        type: 'control',
        message: `Command ${action} queued for ${device}`,
        details: { action, device, duration, command_id: row.id },
      }).catch(() => {});

      return res.status(200).json({
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

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Control error' });
  }
}
