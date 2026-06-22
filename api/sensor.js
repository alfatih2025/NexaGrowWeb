import supabase from './_supabase.js';

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'n'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    id: row.id ?? undefined,
    device_id: row.device_id ?? 'ESP32_001',
    temperature: toNumber(row.temperature, 0),
    humidity: toNumber(row.humidity, 0),
    soil_moisture: toNumber(row.soil_moisture ?? row.soil, 0),
    rain: toNumber(row.rain, 0),
    score: toNumber(row.score ?? row.score_total, 0),
    soil_score: toNumber(row.soil_score ?? row.skor_tanah, null),
    vdp_score: toNumber(row.vdp_score ?? row.skor_vdp, null),
    rain_score: toNumber(row.rain_score ?? row.skor_hujan, null),
    vpd: toNumber(row.vpd, null),
    duration_estimate: toNumber(row.duration_estimate ?? row.duration ?? row.durasi, null),
    pump_status: toBoolean(row.pump_status, false),
    led_status: toBoolean(row.led_status ?? row.feeder_status, false),
    device_mode: row.device_mode === 'auto' || row.device_mode === 'manual' ? row.device_mode : null,
    wifi_status: row.wifi_status ?? 'unknown',
    threshold_kritis: toNumber(row.threshold_kritis, null),
    threshold_atas: toNumber(row.threshold_atas, null),
    threshold_bawah: toNumber(row.threshold_bawah, null),
    watering_time: typeof row.watering_time === 'string' ? row.watering_time : null,
    watering_duration: toNumber(row.watering_duration, null),
    schedule_enabled: toBoolean(row.schedule_enabled, true),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { limit = 100, latest } = req.query;

      if (latest === 'true') {
        const { data, error } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return res.status(200).json(row ? normalizeRow(row) : null);
      }

      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit, 10) || 100);

      if (error) throw error;
      return res.status(200).json(Array.isArray(data) ? data.map(normalizeRow).filter(Boolean) : []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const payload = {
        device_id: body.device_id || 'ESP32_001',
        temperature: toNumber(body.temperature, 0),
        humidity: toNumber(body.humidity, 0),
        ph: toNumber(body.ph, 7),
        turbidity: toNumber(body.turbidity, 0),
        soil_moisture: toNumber(body.soil_moisture ?? body.soil, 0),
        pump_status: toBoolean(body.pump_status, false),
        led_status: toBoolean(body.led_status ?? body.feeder_status, false),
        wifi_status: body.wifi_status || 'connected',
        watering_time: typeof body.watering_time === 'string' ? body.watering_time : null,
        watering_duration: toNumber(body.watering_duration, null),
        schedule_enabled: toBoolean(body.schedule_enabled, true),
      };

      const { data, error } = await supabase
        .from('sensor_data')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(normalizeRow(data));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Sensor API error:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
