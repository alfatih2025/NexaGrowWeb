const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getOpenRouterKey() {
  return readEnv('OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY');
}

export function getOpenRouterModel() {
  return readEnv('OPENROUTER_MODEL', 'VITE_OPENROUTER_MODEL') || 'openai/gpt-4o-mini';
}

function getHeaders(origin) {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': origin || 'http://localhost:3000',
    'X-Title': 'NexaGrow NexaBot',
  };
}

function clampText(value, max = 240) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildSystemPrompt(sensor) {
  const lines = sensor
    ? [
        `- Suhu: ${sensor.temperature ?? '-'}°C`,
        `- Kelembapan Udara: ${sensor.humidity ?? '-'}%`,
        `- Kelembapan Tanah: ${sensor.soil_moisture ?? '-'}%`,
        `- Status Pompa: ${sensor.pump_status ? 'MENYALA' : 'MATI'}`,
        `- Status Lampu: ${sensor.led_status ? 'MENYALA' : 'MATI'}`,
        `- Mode: ${sensor.device_mode ?? '-'}`,
        `- WiFi: ${sensor.wifi_status ?? '-'}`,
        `- Waktu Data: ${sensor.created_at ?? '-'}`,
      ].join('
')
    : '- Data sensor belum tersedia.';

  return [
    'Kamu adalah NexaBot, asisten smart farming berbahasa Indonesia.',
    'Jawab ringkas, jelas, dan fokus pada keputusan operasional pertanian.',
    'Kalau data tidak cukup, sebutkan keterbatasannya lalu beri saran aman.',
    '',
    'DATA SENSOR:',
    lines,
  ].join('
');
}

function localFarmReply(message, sensor) {
  const text = String(message || '').toLowerCase();
  const temp = Number(sensor?.temperature);
  const soil = Number(sensor?.soil_moisture);
  const humidity = Number(sensor?.humidity);

  if (/siram|pompa|air/.test(text)) {
    if (Number.isFinite(soil) && soil < 40) {
      return `Kelembapan tanah ${soil}%. Pompa sebaiknya dinyalakan.`;
    }
    if (Number.isFinite(soil) && soil < 60) {
      return `Kelembapan tanah ${soil}%. Masih aman, tetapi perlu dipantau.`;
    }
    return `Kelembapan tanah ${Number.isFinite(soil) ? `${soil}%` : 'belum terbaca'}. Penyiraman belum mendesak.`;
  }

  if (/status|kondisi/.test(text)) {
    return `Status saat ini: suhu ${Number.isFinite(temp) ? `${temp}°C` : '-'}, kelembapan udara ${Number.isFinite(humidity) ? `${humidity}%` : '-'}, kelembapan tanah ${Number.isFinite(soil) ? `${soil}%` : '-'}.`;
  }

  if (/harian|lapor/.test(text)) {
    return `Laporan singkat: suhu ${Number.isFinite(temp) ? `${temp}°C` : '-'}, kelembapan udara ${Number.isFinite(humidity) ? `${humidity}%` : '-'}, kelembapan tanah ${Number.isFinite(soil) ? `${soil}%` : '-'}.`;
  }

  return 'Saya siap membantu memantau kondisi lahan, penyiraman, dan perangkat IoT.';
}

export async function getOpenRouterStatus(origin) {
  const checkedAt = new Date().toISOString();
  const key = getOpenRouterKey();

  if (!key) {
    return {
      ok: false,
      state: 'missing_key',
      label: 'API key belum diatur',
      detail: 'Tambahkan OPENROUTER_API_KEY di environment Netlify.',
      checkedAt,
    };
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: getHeaders(origin),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
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
  const sensor = sensorContext || null;
  if (!key) {
    return {
      content: localFarmReply(message, sensor),
      provider: 'fallback',
    };
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(sensor) },
    ...history.slice(-8).map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: clampText(item.content, 2000),
    })),
    { role: 'user', content: clampText(message, 2000) },
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: getHeaders(origin),
    body: JSON.stringify({
      model: getOpenRouterModel(),
      messages,
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      payload?.message ||
      payload?.error ||
      `OpenRouter request gagal (${response.status})`,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenRouter tidak mengembalikan jawaban yang valid.');
  }

  return {
    content: content.trim(),
    provider: 'openrouter',
  };
}
