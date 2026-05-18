import supabase from './_supabase.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!supabase) {
    return json(200, {
      online: false,
      wifi_status: 'unknown',
      last_update: null,
      device_id: 'ESP32_001',
      pump_status: false,
      feeder_status: false,
      led_status: false,
    });
  }

  try {
    const { data: latestData, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!latestData) {
      return json(200, {
        online: false,
        wifi_status: 'unknown',
        last_update: null,
        device_id: 'ESP32_001',
        pump_status: false,
        feeder_status: false,
        led_status: false,
      });
    }

    const lastUpdate = new Date(latestData.created_at).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastUpdate) / 60000;
    const online = Number.isFinite(diffMinutes) && diffMinutes < 5;

    return json(200, {
      online,
      wifi_status: latestData.wifi_status || 'unknown',
      last_update: latestData.created_at,
      device_id: latestData.device_id || 'ESP32_001',
      pump_status: Boolean(latestData.pump_status),
      feeder_status: Boolean(latestData.feeder_status),
      led_status: Boolean(latestData.led_status),
    });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Device status error' });
  }
}
