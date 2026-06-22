import fs from 'node:fs';
import path from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

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

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envMap[key] = value;
    }
  } catch {
    // ignore
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

function safeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
}

function safeMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['auto', 'mode_auto', 'automatic', 'otomatis'].includes(normalized)) return 'auto';
  if (['manual', 'mode_manual', 'man', 'manual_mode'].includes(normalized)) return 'manual';
  return null;
}

function normalizeSensorContext(sensor) {
  if (!sensor || typeof sensor !== 'object') return null;

  return {
    device_id: typeof sensor.device_id === 'string' && sensor.device_id.trim() ? sensor.device_id.trim() : null,
    temperature: safeNumber(sensor.temperature),
    humidity: safeNumber(sensor.humidity),
    soil_moisture: safeNumber(sensor.soil_moisture),
    rain: safeNumber(sensor.rain),
    score: safeNumber(sensor.score),
    soil_score: safeNumber(sensor.soil_score),
    vdp_score: safeNumber(sensor.vdp_score),
    rain_score: safeNumber(sensor.rain_score),
    vpd: safeNumber(sensor.vpd),
    duration_estimate: safeNumber(sensor.duration_estimate),
    pump_status: safeBoolean(sensor.pump_status) ?? false,
    led_status: safeBoolean(sensor.led_status) ?? false,
    device_mode: safeMode(sensor.device_mode),
    wifi_status: typeof sensor.wifi_status === 'string' && sensor.wifi_status.trim() ? sensor.wifi_status.trim() : null,
    threshold_kritis: safeNumber(sensor.threshold_kritis),
    threshold_atas: safeNumber(sensor.threshold_atas),
    threshold_bawah: safeNumber(sensor.threshold_bawah),
    watering_time: typeof sensor.watering_time === 'string' && sensor.watering_time.trim() ? sensor.watering_time.trim() : null,
    watering_duration: safeNumber(sensor.watering_duration),
    schedule_enabled: safeBoolean(sensor.schedule_enabled) ?? true,
    created_at: typeof sensor.created_at === 'string' && sensor.created_at.trim() ? sensor.created_at.trim() : null,
    updatedAt: typeof sensor.updatedAt === 'string' && sensor.updatedAt.trim() ? sensor.updatedAt.trim() : null,
    sourceTopic: typeof sensor.sourceTopic === 'string' && sensor.sourceTopic.trim() ? sensor.sourceTopic.trim() : null,
  };
}

function formatLine(label, value, suffix = '') {
  const displayValue = value === null || value === undefined || value === '' ? '-' : value;
  return `- ${label}: ${displayValue}${suffix}`;
}

export function buildSystemPrompt(sensor) {
  const normalized = normalizeSensorContext(sensor);
  const sensorLines = normalized
    ? [
        formatLine('Device ID', normalized.device_id),
        formatLine('Suhu', normalized.temperature, ' °C'),
        formatLine('Kelembapan Udara', normalized.humidity, ' %'),
        formatLine('Kelembapan Tanah', normalized.soil_moisture, ' %'),
        formatLine('Status Pompa', normalized.pump_status ? 'MENYALA' : 'MATI'),
        formatLine('Mode Operasi', normalized.device_mode ? normalized.device_mode.toUpperCase() : 'TIDAK DIKETAHUI'),
        formatLine('Jadwal Siram', normalized.schedule_enabled === false ? 'NONAKTIF' : 'AKTIF'),
        formatLine('Jam Siram', normalized.watering_time),
        formatLine('Durasi Siram', normalized.watering_duration, ' detik'),
        formatLine('WiFi', normalized.wifi_status),
        formatLine('Threshold Kritis', normalized.threshold_kritis),
        formatLine('Threshold Atas', normalized.threshold_atas),
        formatLine('Threshold Bawah', normalized.threshold_bawah),
        formatLine('Waktu Data', normalized.created_at || normalized.updatedAt),
      ].join('\n')
    : '- Data sensor belum tersedia.';

  return [
    'Kamu adalah Smart Farm Assistant untuk aplikasi NexaGrow.',
    'Jawab dalam bahasa Indonesia yang ramah, singkat, dan langsung bisa dipakai.',
    'Fokus pada kondisi tanaman, rekomendasi perawatan, irigasi, jadwal penyiraman, dan perangkat IoT.',
    'Gunakan data sensor yang diberikan sebagai sumber utama. Jangan mengarang angka yang tidak ada.',
    'Jika data sensor belum tersedia, katakan bahwa data belum masuk lalu berikan saran umum yang aman.',
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
