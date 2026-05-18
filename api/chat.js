import supabase from './_supabase.js';
import { sendOpenRouterMessage } from './_openrouter.js';

function safeText(value, fallback) {
  return String(value ?? fallback);
}

async function fetchLatestSensor() {
  const { data, error } = await supabase
    .from('sensor_data')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchLatestWeather() {
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('type', 'weather')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

function getStatusLevel(sensor) {
  if (!sensor) return 'normal';
  if (sensor.temperature > 35 || sensor.soil_moisture < 30) return 'perlu perhatian';
  if (sensor.temperature > 32 || sensor.soil_moisture < 40) return 'waspada';
  return 'baik';
}

function generateDailyReport(sensor, weather) {
  if (!sensor) return 'Data sensor belum tersedia.';

  const lines = [
    '📋 **Laporan Harian**',
    '',
    `🕒 Update: ${new Date().toLocaleString('id-ID')}`,
    '',
    '📊 **Kondisi Sensor**',
    `• Suhu: ${safeText(sensor.temperature, '-')}°C`,
    `• Kelembapan udara: ${safeText(sensor.humidity, '-')}%`,
    `• Kelembapan tanah: ${safeText(sensor.soil_moisture, '-')}%`,
    `• pH tanah: ${safeText(sensor.ph, '-')} `,
    '',
    '🔧 **Status Perangkat**',
    `• Pompa: ${sensor.pump_status ? 'Aktif' : 'Nonaktif'}`,
    `• Lampu: ${sensor.led_status ? 'Aktif' : 'Nonaktif'}`,
    `• Mode: ${sensor.device_mode || 'tidak diketahui'}`,
    `• WiFi: ${sensor.wifi_status || 'unknown'}`,
    '',
    '💡 **Rekomendasi**',
    weather?.message ? `• Cuaca: ${weather.message}` : '• Pantau kelembapan tanah dan siram saat turun di bawah ambang aman.',
  ];

  return lines.join('
');
}

function buildFallbackReply(message, sensor, weather) {
  const text = message.toLowerCase();
  const soil = Number(sensor?.soil_moisture ?? 60);

  if (text.includes('siram') || text.includes('pompa')) {
    if (soil < 40) {
      return `💧 Kelembapan tanah ${soil}% sudah rendah. Pompa sebaiknya dinyalakan sekarang.`;
    }
    if (soil < 60) {
      return `⚠️ Kelembapan tanah ${soil}% mulai turun. Pantau dan siapkan penyiraman.`;
    }
    return `✅ Kelembapan tanah ${soil}% masih aman. Belum perlu penyiraman.`;
  }

  if (text.includes('status') || text.includes('kondisi')) {
    return [
      `📊 Suhu: ${safeText(sensor?.temperature, '-') }°C`,
      `💧 Tanah: ${safeText(sensor?.soil_moisture, '-') }%`,
      `🔌 Pompa: ${sensor?.pump_status ? 'Aktif' : 'Mati'}`,
      `💡 Lampu: ${sensor?.led_status ? 'Aktif' : 'Mati'}`,
      `☁️ Cuaca: ${weather?.message || 'Tidak tersedia'}`,
      `Kondisi lahan saat ini: ${getStatusLevel(sensor)}`,
    ].join('
');
  }

  if (text.includes('lapor') || text.includes('harian')) {
    return generateDailyReport(sensor, weather);
  }

  return `Berdasarkan data terakhir, kondisi lahan saat ini ${getStatusLevel(sensor)}. Jika ingin, saya bisa bantu membaca suhu, kelembapan tanah, dan status pompa.`;
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
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(Math.max(1, Math.min(200, parseInt(limit, 10) || 50)));

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const message = String(body.message || '').trim();
      const user_id = String(body.user_id || 'anonymous').trim() || 'anonymous';
      const history = Array.isArray(body.history) ? body.history : [];

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const createdAt = new Date().toISOString();
      const userRecord = {
        user_id,
        role: 'user',
        content: message,
        created_at: createdAt,
      };

      const { error: userInsertError } = await supabase.from('chat_messages').insert(userRecord);
      if (userInsertError) throw userInsertError;

      const [latestSensor, latestWeather] = await Promise.all([
        fetchLatestSensor().catch(() => null),
        fetchLatestWeather().catch(() => null),
      ]);

      let aiResponse = '';
      try {
        const result = await sendOpenRouterMessage({
          message,
          history,
          sensorContext: latestSensor,
          origin: req.headers.origin,
        });
        aiResponse = result.content;
      } catch (aiError) {
        aiResponse = buildFallbackReply(message, latestSensor, latestWeather);
        await supabase.from('activity_logs').insert({
          type: 'ai_chat_fallback',
          message: 'OpenRouter fallback response used',
          details: { error: aiError?.message || String(aiError) },
          created_at: new Date().toISOString(),
        }).catch(() => {});
      }

      const assistantRecord = {
        user_id,
        role: 'assistant',
        content: aiResponse,
        created_at: new Date().toISOString(),
      };

      const { data: assistantMessage, error: assistantInsertError } = await supabase
        .from('chat_messages')
        .insert(assistantRecord)
        .select()
        .single();

      if (assistantInsertError) throw assistantInsertError;

      await supabase.from('activity_logs').insert({
        type: 'ai_chat',
        message: `AI response for ${user_id}`,
        details: { user_message: message, model: 'openrouter', sensor_id: latestSensor?.device_id || null },
        created_at: new Date().toISOString(),
      }).catch(() => {});

      return res.status(200).json({
        content: assistantMessage.content,
        message: assistantMessage,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({ error: err.message || 'Chat API error' });
  }
}
