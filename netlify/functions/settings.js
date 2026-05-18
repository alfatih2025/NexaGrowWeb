import supabase from './_supabase.js';

const DEFAULT_SETTINGS = {
  id: 1,
  crop_mode: 'padi',
  location: 'bmkg',
  temp_threshold_high: 35,
  temp_threshold_low: 20,
  soil_moisture_threshold: 40,
  ph_min: 5.5,
  ph_max: 8.0,
  auto_report: true,
  report_time: '08:00',
  user_name: 'Petani Cerdas',
  user_email: 'petani@sprout.id',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeSettings(input) {
  const obj = { ...DEFAULT_SETTINGS, ...(input || {}) };
  return {
    ...obj,
    id: 1,
    crop_mode: ['padi', 'cabai', 'jagung', 'sayur'].includes(obj.crop_mode) ? obj.crop_mode : DEFAULT_SETTINGS.crop_mode,
    location: String(obj.location || DEFAULT_SETTINGS.location).trim() || DEFAULT_SETTINGS.location,
    temp_threshold_high: clampNumber(obj.temp_threshold_high, -20, 60, DEFAULT_SETTINGS.temp_threshold_high),
    temp_threshold_low: clampNumber(obj.temp_threshold_low, -20, 60, DEFAULT_SETTINGS.temp_threshold_low),
    soil_moisture_threshold: clampNumber(obj.soil_moisture_threshold, 0, 100, DEFAULT_SETTINGS.soil_moisture_threshold),
    ph_min: clampNumber(obj.ph_min, 0, 14, DEFAULT_SETTINGS.ph_min),
    ph_max: clampNumber(obj.ph_max, 0, 14, DEFAULT_SETTINGS.ph_max),
    auto_report: Boolean(obj.auto_report),
    report_time: typeof obj.report_time === 'string' && /^\d{2}:\d{2}$/.test(obj.report_time) ? obj.report_time : DEFAULT_SETTINGS.report_time,
    user_name: String(obj.user_name || DEFAULT_SETTINGS.user_name).trim() || DEFAULT_SETTINGS.user_name,
    user_email: String(obj.user_email || DEFAULT_SETTINGS.user_email).trim() || DEFAULT_SETTINGS.user_email,
    updated_at: new Date().toISOString(),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!supabase) return json(200, DEFAULT_SETTINGS);

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return json(200, data || DEFAULT_SETTINGS);
    }

    if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const payload = normalizeSettings(body);

      const { data, error } = await supabase
        .from('settings')
        .upsert(payload)
        .select('*')
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        type: 'settings',
        message: 'Settings updated',
        details: payload,
      }).catch(() => {});

      return json(200, data || payload);
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Settings API error' });
  }
}
