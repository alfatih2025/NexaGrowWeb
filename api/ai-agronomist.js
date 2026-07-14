import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';
import supabase from '../src/lib/apiHelpers/_supabase.js';
import mqtt from 'mqtt';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

// MQTT Broker config (public HiveMQ for example)
const MQTT_BROKER_URL = 'mqtt://broker.hivemq.com:1883';
const MQTT_TOPIC_COMMAND = 'nexagrow/v2/command';

// Publish to MQTT wrapped in Promise
function publishMqttCommand(payload) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_BROKER_URL);
    client.on('connect', () => {
      client.publish(MQTT_TOPIC_COMMAND, JSON.stringify(payload), { qos: 1 }, (err) => {
        client.end();
        if (err) reject(err);
        else resolve();
      });
    });
    client.on('error', (err) => {
      client.end();
      reject(err);
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Allow cron job bypass or require API auth
  const isCron = req.headers['user-agent'] === 'vercel-cron/1.0';
  if (!isCron && !requireApiAuth(req, res)) return;

  try {
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

    const locationCode = latestSettings?.location || '33.74.07.1010';
    let weatherData = null;
    try {
      const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(locationCode)}`;
      const bmkgRes = await fetch(bmkgUrl);
      if (bmkgRes.ok) {
        weatherData = await bmkgRes.json();
      }
    } catch (err) {
      console.error('Failed to fetch weather', err);
    }

    const systemPrompt = `Kamu adalah NexaGrow Decision Engine (NDE).
Tugas kamu adalah menganalisis data sensor, pengaturan, dan cuaca terkini untuk menetapkan GOAL penyiraman tanaman yang akan dieksekusi secara otonom oleh Controller (ESP32).
Return your response STRICTLY as a JSON object with the following structure:
{
  "mode": "AI",
  "allowWatering": boolean,
  "targetMoisture": number, (analog raw value 0-4095. 1500 is wet, 3000 is dry. Typically target is around 1800-2000)
  "maxDuration": number, (in seconds, safety limit, e.g., 40-60)
  "priority": "NORMAL" | "HIGH",
  "confidence": number, (0-100)
  "reason": "string", (Explainable AI reason)
  "aiVersion": "2.1.0"
}`;

    const message = `Sensor Data: ${JSON.stringify(latestSensor || {})}
Settings: ${JSON.stringify(latestSettings || {})}
Weather: ${JSON.stringify(weatherData || {})}`;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY || 'demo-key'}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://nexagrow.vercel.app',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      })
    });

    if (!openRouterRes.ok) {
      throw new Error(`OpenRouter error: ${await openRouterRes.text()}`);
    }

    const openRouterData = await openRouterRes.json();
    const content = openRouterData?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    // Tambahkan ValidUntil (misal valid selama 12 jam ke depan)
    const currentEpoch = Math.floor(Date.now() / 1000);
    parsed.validUntil = currentEpoch + (12 * 60 * 60);
    parsed.currentEpoch = currentEpoch; // untuk sinkronisasi waktu Node

    // Publish langsung ke MQTT agar Gateway mengeksekusinya
    try {
      await publishMqttCommand(parsed);
      console.log('Successfully published NDE command to MQTT');
    } catch (mqttErr) {
      console.error('Failed to publish to MQTT:', mqttErr);
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
