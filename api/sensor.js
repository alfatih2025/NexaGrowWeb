import supabase from './_supabase.js';

const DEFAULT_DEVICE_ID = 'ESP32_001';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function normalizeSensorBody(body = {}) {
  const createdAt = body.created_at || body.timestamp || new Date().toISOString();
  return {
    device_id: String(body.device_id || DEFAULT_DEVICE_ID).trim() || DEFAULT_DEVICE_ID,
    temperature: toNumber(body.temperature, 0),
    humidity: toNumber(body.humidity, 0),
    ph: toNumber(body.ph, 7),
    turbidity: toNumber(body.turbidity, 0),
    soil_moisture: toNumber(body.soil_moisture, 0),
    pump_status: toBoolean(body.pump_status, false),
    feeder_status: toBoolean(body.feeder_status, false),
    led_status: toBoolean(body.led_status, false),
    device_mode: body.device_mode === 'auto' || body.device_mode === 'manual' ? body.device_mode : null,
    wifi_status: String(body.wifi_status || 'connected').trim() || 'connected',
    created_at: createdAt,
  };
}

async function upsertDeviceStatus(snapshot) {
  const payload = {
    device_id: snapshot.device_id,
    online: true,
    wifi_status: snapshot.wifi_status,
    last_seen_at: snapshot.created_at,
    pump_status: snapshot.pump_status,
    feeder_status: snapshot.feeder_status,
    led_status: snapshot.led_status,
    device_mode: snapshot.device_mode,
    updated_at: snapshot.created_at,
    source: 'sensor',
  };

  const result = await supabase.from('device_status').upsert(payload, { onConflict: 'device_id' });
  if (result.error) throw result.error;
}

async function writeActivityLog(snapshot) {
  const payload = {
    type: 'sensor',
    message: `Sensor update from ${snapshot.device_id}`,
    details: snapshot,
    created_at: snapshot.created_at,
  };
  const result = await supabase.from('activity_logs').insert(payload);
  if (result.error) throw result.error;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { limit = 100, latest = 'false' } = req.query;

      if (latest === 'true') {
        const { data, error } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return res.status(200).json(data || null);
      }

      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(1000, parseInt(limit, 10) || 100)));

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const snapshot = normalizeSensorBody(req.body || {});

      const { data, error } = await supabase
        .from('sensor_data')
        .insert(snapshot)
        .select()
        .single();

      if (error) throw error;

      try {
        await upsertDeviceStatus(snapshot);
      } catch (statusError) {
        console.warn('device_status upsert skipped:', statusError?.message || statusError);
      }

      try {
        await writeActivityLog(snapshot);
      } catch (logError) {
        console.warn('activity log insert skipped:', logError?.message || logError);
      }

      return res.status(201).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Sensor API error:', err);
    res.status(500).json({ error: err.message || 'Sensor API error' });
  }
}
