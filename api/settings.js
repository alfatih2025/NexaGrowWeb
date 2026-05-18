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

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSettings(input = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    crop_mode: ['padi', 'cabai', 'jagung', 'sayur'].includes(input.crop_mode) ? input.crop_mode : DEFAULT_SETTINGS.crop_mode,
    location: String(input.location || DEFAULT_SETTINGS.location).trim(),
    temp_threshold_high: clampNumber(input.temp_threshold_high, -10, 60, DEFAULT_SETTINGS.temp_threshold_high),
    temp_threshold_low: clampNumber(input.temp_threshold_low, -10, 50, DEFAULT_SETTINGS.temp_threshold_low),
    soil_moisture_threshold: clampNumber(input.soil_moisture_threshold, 0, 100, DEFAULT_SETTINGS.soil_moisture_threshold),
    ph_min: clampNumber(input.ph_min, 0, 14, DEFAULT_SETTINGS.ph_min),
    ph_max: clampNumber(input.ph_max, 0, 14, DEFAULT_SETTINGS.ph_max),
    auto_report: typeof input.auto_report === 'boolean' ? input.auto_report : DEFAULT_SETTINGS.auto_report,
    report_time: /^\d{2}:\d{2}$/.test(String(input.report_time || '')) ? String(input.report_time) : DEFAULT_SETTINGS.report_time,
    user_name: String(input.user_name || DEFAULT_SETTINGS.user_name).trim(),
    user_email: String(input.user_email || DEFAULT_SETTINGS.user_email).trim(),
    updated_at: new Date().toISOString(),
  };
}

async function fetchCurrentSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const data = await fetchCurrentSettings().catch(() => null);
      return res.status(200).json(data ? normalizeSettings(data) : DEFAULT_SETTINGS);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const current = await fetchCurrentSettings().catch(() => null);
      const normalized = normalizeSettings({ ...(current || DEFAULT_SETTINGS), ...(req.body || {}) });

      const { data, error } = await supabase
        .from('settings')
        .upsert({ ...normalized, id: 1 }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        type: 'settings',
        message: 'Settings updated',
        details: normalized,
        created_at: new Date().toISOString(),
      }).catch(() => {});

      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings API error:', err);
    res.status(500).json({ error: err.message || 'Settings API error' });
  }
}
