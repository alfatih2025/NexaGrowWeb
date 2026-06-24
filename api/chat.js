import { requireApiAuth, authError } from './_auth.js';
import supabase from './_supabase.js';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;


const ARDUINO_FORMULA_REFERENCE = [
  'RUMUS ARDUINO NANO YANG WAJIB DIIKUTI:',
  '1) Soil moisture percent:',
  '   moisture = constrain(mapFloat(rawSoil, SOIL_RAW_DRY, SOIL_RAW_WET, 0, 100), 0, 100)',
  '   dengan kalibrasi default: SOIL_RAW_DRY = 830 dan SOIL_RAW_WET = 350',
  '',
  '2) Vapor Pressure Deficit (VPD):',
  '   svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3))',
  '   avp = svp * (kelembapan_udara / 100)',
  '   vpd = svp - avp',
  '',
  '3) Soil score:',
  '   soilRange = atas - kritis',
  '   skortanah = constrain(((atas - k_tanah) * 50) / soilRange, 0, 50)',
  '',
  '4) VPD score:',
  '   skorvdp = constrain(mapFloat(vpd, 0.4, 2.0, 0, 30), 0, 30)',
  '',
  '5) Total score:',
  '   skortotal = skortanah + skorvdp - skorhujan',
  '',
  '6) Estimasi durasi siram:',
  '   durasi_total = round(max(0, 5 * (atas - k_tanah) / 100 * max(vpd, 0.5)))',
  '',
  '7) Logika relay:',
  '   ON jika k_tanah <= kritis atau skortotal >= 60',
  '   OFF jika k_tanah >= atas atau hujan >= 5 atau suhu <= 20',
].join('\n');


function buildSystemPrompt(latestSensor, settings = {}) {
  const phase = String(settings.plant_phase || settings.crop_mode || 'vegetatif').trim().toLowerCase() === 'generatif'
    ? 'generatif'
    : 'vegetatif';

  return `Kamu adalah Smart Farm Assistant, ahli pertanian cerdas yang membantu petani mengelola lahan.

FOKUS:
- Fase tanaman aktif: ${phase.toUpperCase()}
- Suhu: ${latestSensor?.temperature ?? 28}°C
- Kelembapan Udara: ${latestSensor?.humidity ?? 70}%
- Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%
- Ambang Suhu: ${settings.temp_threshold_low ?? 0} - ${settings.temp_threshold_high ?? 0} °C
- Ambang Kelembapan Udara: ${settings.humidity_threshold_low ?? 0} - ${settings.humidity_threshold_high ?? 0} %
- Ambang Kelembapan Tanah: ${settings.soil_threshold_low ?? settings.soil_moisture_threshold ?? 40} - ${settings.soil_threshold_high ?? 80} % (kritis ${settings.soil_threshold_critical ?? 30} %)
- Status Pompa: ${latestSensor?.pump_status ? 'MENYALA' : 'MATI'}
- Jadwal Siram: ${latestSensor?.schedule_enabled === false ? 'NONAKTIF' : 'AKTIF'}
- Jam Siram: ${latestSensor?.watering_time ?? '-'}
- Durasi Siram: ${latestSensor?.watering_duration ?? '-'} detik

Gunakan rumus pengolahan Arduino berikut tanpa mengganti konstanta kecuali pengguna meminta kalibrasi baru secara eksplisit.

Jika user memberi prompt yang membahas iklim berbeda atau kondisi hipotetis lain, jawab sesuai skenario itu, bukan memaksa data sensor asli. Gunakan bahasa Indonesia yang ramah, singkat, dan akurat.`;
}

function getStatusLevel(latestSensor, settings = {}) {
  const low = Number(settings.soil_threshold_low ?? settings.soil_moisture_threshold ?? 40);
  const critical = Number(settings.soil_threshold_critical ?? Math.max(20, low - 10));
  const soilMoisture = Number(latestSensor?.soil_moisture ?? 60);
  if (soilMoisture <= critical) return 'kritis';
  if (soilMoisture < low) return 'waspada';
  return 'aman';
}

function generateDailyReport(latestSensor) {
  return `📊 Laporan Harian:\n\n🌡️ Suhu: ${latestSensor?.temperature ?? 28}°C\n💧 Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%\n🔌 Pompa: ${latestSensor?.pump_status ? 'Aktif' : 'Nonaktif'}\n🕒 Jadwal Siram: ${latestSensor?.watering_time ?? '-'} (${latestSensor?.schedule_enabled === false ? 'Nonaktif' : 'Aktif'})\n\nSecara keseluruhan kondisi lahan ${getStatusLevel(latestSensor)}.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!requireApiAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { limit = 50 } = req.query;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(parseInt(limit, 10));

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { message, user_id = 'anonymous' } = req.body || {};

      await supabase.from('chat_messages').insert({
        user_id,
        role: 'user',
        content: message,
      });

      const { data: latestSensor } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: latestSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const systemPrompt = buildSystemPrompt(latestSensor, latestSettings || {});

      let aiResponse = '';

      const lowerMessage = String(message || '').toLowerCase();

      if (lowerMessage.includes('siram') || lowerMessage.includes('pompa')) {
        const soilMoisture = latestSensor?.soil_moisture ?? 60;
        const low = Number(latestSettings?.soil_threshold_low ?? latestSettings?.soil_moisture_threshold ?? 40);
        const critical = Number(latestSettings?.soil_threshold_critical ?? Math.max(20, low - 10));
        if (soilMoisture <= critical) {
          aiResponse = `💧 Kondisi kritis. Kelembapan tanah ${soilMoisture}% sudah di bawah batas kritis ${critical}%.`;
        } else if (soilMoisture < low) {
          aiResponse = `⚠️ Kelembapan tanah ${soilMoisture}% mulai turun di bawah batas bawah ${low}%.`;
        } else {
          aiResponse = `✅ Kelembapan tanah ${soilMoisture}% masih cukup baik.`;
        }
      } else if (lowerMessage.includes('status') || lowerMessage.includes('sawah')) {
        aiResponse = `📊 Status lahan:\n\n🌡️ Suhu: ${latestSensor?.temperature ?? 28}°C\n💧 Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%\n🔌 Pompa: ${latestSensor?.pump_status ? 'Aktif' : 'Nonaktif'}\n🕒 Jadwal Siram: ${latestSensor?.watering_time ?? '-'} (${latestSensor?.schedule_enabled === false ? 'Nonaktif' : 'Aktif'})\n\nSecara keseluruhan kondisi lahan ${getStatusLevel(latestSensor, latestSettings)}.`;
      } else if (lowerMessage.includes('lapor') || lowerMessage.includes('harian')) {
        aiResponse = generateDailyReport(latestSensor);
      } else {
        try {
          const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY || 'demo-key'}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': req.headers.origin || 'https://sprout-v2.vercel.app',
            },
            body: JSON.stringify({
              model: process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt + '\n\n' + ARDUINO_FORMULA_REFERENCE },
                { role: 'user', content: message },
              ],
              temperature: 0.5,
              max_tokens: 400,
            }),
          });

          const openRouterData = await openRouterRes.json();
          aiResponse = openRouterData?.choices?.[0]?.message?.content ||
            'Maaf, saya belum bisa memproses pertanyaan ini.';
        } catch (error) {
          aiResponse = `Maaf, saya sedang kesulitan terhubung ke AI. ${error instanceof Error ? error.message : ''}`;
        }
      }

      const assistantMessage = await supabase.from('chat_messages').insert({
        user_id: 'assistant_001',
        role: 'assistant',
        content: aiResponse,
      }).select().single();

      return res.status(200).json({
        success: true,
        message: aiResponse,
        data: assistantMessage.data,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown chat error',
    });
  }
}
