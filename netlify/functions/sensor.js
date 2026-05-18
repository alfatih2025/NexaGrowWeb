import supabase from './_supabase.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRow(body) {
  const timestamp = body.created_at || body.timestamp || new Date().toISOString();
  return {
    device_id: body.device_id || 'ESP32_001',
    temperature: toNumber(body.temperature, 0),
    humidity: toNumber(body.humidity, 0),
    ph: toNumber(body.ph, 7),
    turbidity: toNumber(body.turbidity, 0),
    soil_moisture: toNumber(body.soil_moisture, 0),
    pump_status: Boolean(body.pump_status),
    feeder_status: Boolean(body.feeder_status),
    led_status: Boolean(body.led_status),
    device_mode: body.device_mode === 'auto' ? 'auto' : body.device_mode === 'manual' ? 'manual' : null,
    wifi_status: body.wifi_status || 'connected',
    created_at: timestamp,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (!supabase) return json(500, { error: 'Supabase belum dikonfigurasi' });

  try {
    if (event.httpMethod === 'GET') {
      const latest = String(event.queryStringParameters?.latest ?? '') === 'true';
      const limit = Math.min(Number(event.queryStringParameters?.limit ?? 100) || 100, 500);

      if (latest) {
        const { data, error } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return json(200, data || null);
      }

      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return json(200, data || []);
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const row = normalizeRow(body);

      const { data, error } = await supabase
        .from('sensor_data')
        .insert(row)
        .select('*')
        .single();

      if (error) throw error;
      return json(201, data);
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Sensor API error' });
  }
}
