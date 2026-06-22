import supabase from './_supabase.js';
import { requireApiAuth } from './_auth.js';

const DEFAULT_SETTINGS = {
  id: 1,
  plant_phase: 'vegetatif',
  location: 'bmkg',
  temp_threshold_high: 34,
  temp_threshold_low: 22,
  soil_threshold_low: 45,
  soil_threshold_high: 75,
  soil_threshold_critical: 35,
  ph_min: 5.5,
  ph_max: 8.0,
  auto_report: true,
  report_time: '08:00',
  watering_time: '06:00',
  watering_duration: 10,
  watering_enabled: true,
  user_name: 'Petani Cerdas',
  user_email: 'petani@sprout.id',
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizePhase(value) {
  return String(value || '').trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
}

function phaseDefaults(phase) {
  return phase === 'generatif'
    ? { temp_threshold_low: 24, temp_threshold_high: 32, soil_threshold_low: 50, soil_threshold_high: 70, soil_threshold_critical: 40 }
    : { temp_threshold_low: 22, temp_threshold_high: 34, soil_threshold_low: 45, soil_threshold_high: 75, soil_threshold_critical: 35 };
}

function normalizeSettings(input = {}) {
  const obj = { ...DEFAULT_SETTINGS, ...(input || {}) };
  const phase = normalizePhase(obj.plant_phase || obj.crop_mode);
  const defaults = phaseDefaults(phase);
  const soilLow = clampNumber(obj.soil_threshold_low ?? obj.soil_moisture_threshold ?? defaults.soil_threshold_low, 0, 100, defaults.soil_threshold_low);
  const soilHigh = clampNumber(obj.soil_threshold_high ?? defaults.soil_threshold_high, 0, 100, defaults.soil_threshold_high);
  const soilCritical = clampNumber(obj.soil_threshold_critical ?? defaults.soil_threshold_critical, 0, 100, defaults.soil_threshold_critical);

  return {
    ...obj,
    id: 1,
    plant_phase: phase,
    crop_mode: phase,
    location: String(obj.location || DEFAULT_SETTINGS.location).trim() || DEFAULT_SETTINGS.location,
    temp_threshold_high: clampNumber(obj.temp_threshold_high ?? defaults.temp_threshold_high, -20, 60, defaults.temp_threshold_high),
    temp_threshold_low: clampNumber(obj.temp_threshold_low ?? defaults.temp_threshold_low, -20, 60, defaults.temp_threshold_low),
    soil_threshold_low: Math.min(soilLow, soilHigh - 1),
    soil_threshold_high: Math.max(soilHigh, soilLow + 1),
    soil_threshold_critical: Math.min(soilCritical, soilLow),
    ph_min: clampNumber(obj.ph_min, 0, 14, DEFAULT_SETTINGS.ph_min),
    ph_max: clampNumber(obj.ph_max, 0, 14, DEFAULT_SETTINGS.ph_max),
    auto_report: Boolean(obj.auto_report),
    report_time: typeof obj.report_time === 'string' && /^\d{2}:\d{2}$/.test(obj.report_time) ? obj.report_time : DEFAULT_SETTINGS.report_time,
    watering_time: typeof obj.watering_time === 'string' && /^\d{2}:\d{2}$/.test(obj.watering_time) ? obj.watering_time : DEFAULT_SETTINGS.watering_time,
    watering_duration: clampNumber(obj.watering_duration, 1, 3600, DEFAULT_SETTINGS.watering_duration),
    watering_enabled: Boolean(obj.watering_enabled),
    user_name: String(obj.user_name || DEFAULT_SETTINGS.user_name).trim() || DEFAULT_SETTINGS.user_name,
    user_email: String(obj.user_email || DEFAULT_SETTINGS.user_email).trim() || DEFAULT_SETTINGS.user_email,
    updated_at: new Date().toISOString(),
    soil_moisture_threshold: soilLow,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      if (!supabase) return res.status(200).json(DEFAULT_SETTINGS);

      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        return res.status(200).json(DEFAULT_SETTINGS);
      }

      return res.status(200).json(data || DEFAULT_SETTINGS);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      if (!requireApiAuth(req, res)) return;

      const updates = req.body || {};
      const payload = normalizeSettings(updates);

      const { data, error } = await supabase
        .from('settings')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        type: 'settings',
        message: 'Settings updated',
        details: updates,
      }).catch(() => {});

      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings API error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
