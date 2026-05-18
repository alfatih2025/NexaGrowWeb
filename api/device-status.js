import supabase from './_supabase.js';

const DEVICE_TIMEOUT_MINUTES = 3;

function isRecent(isoString) {
  if (!isoString) return false;
  const ts = new Date(isoString).getTime();
  if (!Number.isFinite(ts)) return false;
  return (Date.now() - ts) / 60000 <= DEVICE_TIMEOUT_MINUTES;
}

function normalizeStatusRecord(record) {
  if (!record) return null;
  const lastSeenAt = record.last_seen_at || record.updated_at || record.created_at || null;
  const online = typeof record.online === 'boolean' ? record.online : isRecent(lastSeenAt);

  return {
    online,
    wifi_status: record.wifi_status || 'unknown',
    last_update: lastSeenAt,
    device_id: record.device_id || 'ESP32_001',
    pump_status: Boolean(record.pump_status),
    feeder_status: Boolean(record.feeder_status),
    led_status: Boolean(record.led_status),
    device_mode: record.device_mode || null,
    source: record.source || 'status',
  };
}

async function fetchLatestDeviceStatus() {
  const { data, error } = await supabase
    .from('device_status')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fallbackFromSensorData() {
  const { data, error } = await supabase
    .from('sensor_data')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    device_id: data.device_id,
    wifi_status: data.wifi_status,
    last_seen_at: data.created_at,
    pump_status: data.pump_status,
    feeder_status: data.feeder_status,
    led_status: data.led_status,
    device_mode: data.device_mode,
    source: 'sensor',
  };
}

async function upsertDeviceStatus(body = {}) {
  const payload = {
    device_id: String(body.device_id || 'ESP32_001').trim() || 'ESP32_001',
    online: typeof body.online === 'boolean' ? body.online : true,
    wifi_status: String(body.wifi_status || 'connected').trim() || 'connected',
    last_seen_at: body.last_seen_at || new Date().toISOString(),
    pump_status: Boolean(body.pump_status),
    feeder_status: Boolean(body.feeder_status),
    led_status: Boolean(body.led_status),
    device_mode: body.device_mode === 'auto' || body.device_mode === 'manual' ? body.device_mode : null,
    source: String(body.source || 'heartbeat').trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('device_status').upsert(payload, { onConflict: 'device_id' }).select().single();
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
      let raw = null;
      try {
        raw = await fetchLatestDeviceStatus();
      } catch {
        raw = await fallbackFromSensorData();
      }

      const normalized = normalizeStatusRecord(raw) || {
        online: false,
        wifi_status: 'unknown',
        last_update: null,
        device_id: 'ESP32_001',
        pump_status: false,
        feeder_status: false,
        led_status: false,
        device_mode: null,
        source: 'status',
      };

      return res.status(200).json(normalized);
    }

    if (req.method === 'POST') {
      const updated = await upsertDeviceStatus(req.body || {});
      return res.status(200).json(normalizeStatusRecord(updated));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Device status error:', err);
    res.status(500).json({ error: err.message || 'Device status error' });
  }
}
