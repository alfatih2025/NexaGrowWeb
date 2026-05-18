import fs from 'node:fs';
import path from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

let cachedLocalEnv = null;

function readLocalEnv() {
  if (cachedLocalEnv) return cachedLocalEnv;

  const envMap = {};

  try {
    const envPath = path.join(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf8');

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      envMap[key] = value;
    }
  } catch {
    // Ignore local .env read failures and fall back to process.env only.
  }

  cachedLocalEnv = envMap;
  return envMap;
}

function getOpenRouterKey() {
  const localEnv = readLocalEnv();
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.VITE_OPENROUTER_API_KEY ||
    localEnv.OPENROUTER_API_KEY ||
    localEnv.VITE_OPENROUTER_API_KEY ||
    ''
  ).trim();
}

function getOpenRouterModel() {
  const localEnv = readLocalEnv();
  return (
    process.env.OPENROUTER_MODEL ||
    process.env.VITE_OPENROUTER_MODEL ||
    localEnv.OPENROUTER_MODEL ||
    localEnv.VITE_OPENROUTER_MODEL ||
    'openai/gpt-4o-mini'
  ).trim();
}

function getHeaders(origin) {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': origin || 'http://localhost:5500',
    'X-Title': 'NexaGrow NexaBot',
  };
}

function buildSystemPrompt(sensor) {
  const sensorLines = sensor
    ? [
        `- Suhu: ${sensor.temperature ?? '-'} C`,
        `- Kelembapan Udara: ${sensor.humidity ?? '-'}%`,
        `- pH Tanah: ${sensor.ph ?? '-'}`,
        `- Turbiditas: ${sensor.turbidity ?? '-'} NTU`,
        `- Kelembapan Tanah: ${sensor.soil_moisture ?? '-'}%`,
        `- Status Pompa: ${sensor.pump_status ? 'MENYALA' : 'MATI'}`,
        `- Status Feeder: ${sensor.feeder_status ? 'MENYALA' : 'MATI'}`,
        `- Status Lampu: ${sensor.led_status ? 'MENYALA' : 'MATI'}`,
        `- WiFi: ${sensor.wifi_status ?? 'Tidak diketahui'}`,
        `- Waktu Data: ${sensor.created_at ?? 'Tidak tersedia'}`,
      ].join('\n')
    : '- Data sensor belum tersedia.';

  return [
    'Kamu adalah Smart Farm Assistant untuk aplikasi Sprout v2.',
    'Jawab dalam bahasa Indonesia yang ramah, singkat, dan langsung bisa dipakai.',
    'Fokus pada kondisi sawah, rekomendasi perawatan, irigasi, cuaca, dan perangkat IoT.',
    'Jika data kurang lengkap, katakan dengan jujur lalu beri saran aman yang umum dipakai.',
    '',
    'DATA SENSOR TERKINI:',
    sensorLines,
  ].join('\n');
}

export async function getOpenRouterStatus(origin) {
  const key = getOpenRouterKey();
  const checkedAt = new Date().toISOString();

  if (!key) {
    return {
      ok: false,
      state: 'missing_key',
      label: 'API key belum diatur',
      detail: 'Tambahkan OPENROUTER_API_KEY di environment server.',
      checkedAt,
    };
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: getHeaders(origin),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        state: 'error',
        label: 'OpenRouter tidak tersambung',
        detail: detail || `HTTP ${response.status}`,
        checkedAt,
      };
    }

    return {
      ok: true,
      state: 'connected',
      label: 'OpenRouter terhubung',
      detail: `Model aktif: ${getOpenRouterModel()}`,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      state: 'error',
      label: 'OpenRouter tidak tersambung',
      detail: error instanceof Error ? error.message : 'Unknown connection error',
      checkedAt,
    };
  }
}

export async function sendOpenRouterMessage({ message, history = [], sensorContext = null, origin }) {
  const key = getOpenRouterKey();
  if (!key) {
    throw new Error('OPENROUTER_API_KEY belum diatur di server.');
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(sensorContext) },
    ...history.slice(-8).map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    })),
    { role: 'user', content: message },
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: getHeaders(origin),
    body: JSON.stringify({
      model: getOpenRouterModel(),
      messages,
      temperature: 0.5,
      max_tokens: 500,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      payload?.message ||
      `OpenRouter request gagal dengan status ${response.status}`,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenRouter tidak mengembalikan jawaban yang valid.');
  }

  return {
    content: content.trim(),
    model: getOpenRouterModel(),
    checkedAt: new Date().toISOString(),
  };
}
