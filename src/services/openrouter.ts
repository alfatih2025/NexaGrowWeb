import { buildApiHeaders } from '../lib/apiAuth';

const OPENROUTER_CHAT_ENDPOINT = '/api/openrouter-chat';
const OPENROUTER_STATUS_ENDPOINT = '/api/openrouter-status';
const SENSOR_ENDPOINT = '/api/sensor?latest=true';

export type OpenRouterConnectionState =
  | 'checking'
  | 'connected'
  | 'missing_key'
  | 'error';

export interface OpenRouterStatus {
  state: OpenRouterConnectionState;
  label: string;
  detail: string;
  checkedAt?: string;
}

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SensorSnapshotContext {
  device_id?: string;
  temperature?: number | null;
  humidity?: number | null;
  soil_moisture?: number | null;
  rain?: number | null;
  score?: number | null;
  soil_score?: number | null;
  vdp_score?: number | null;
  rain_score?: number | null;
  vpd?: number | null;
  duration_estimate?: number | null;
  pump_status?: boolean;
  led_status?: boolean;
  device_mode?: 'manual' | 'auto' | null;
  wifi_status?: string | null;
  threshold_kritis?: number | null;
  threshold_atas?: number | null;
  threshold_bawah?: number | null;
  watering_time?: string | null;
  watering_duration?: number | null;
  schedule_enabled?: boolean;
  created_at?: string | null;
  updatedAt?: string | null;
  sourceTopic?: string | null;
  plant_phase?: 'vegetatif' | 'generatif' | null;
  soil_threshold_low?: number | null;
  soil_threshold_high?: number | null;
  soil_threshold_critical?: number | null;
  temp_threshold_low?: number | null;
  temp_threshold_high?: number | null;
}

interface SensorSnapshotApi {
  device_id?: string;
  temperature?: number | string | null;
  humidity?: number | string | null;
  soil_moisture?: number | string | null;
  rain?: number | string | null;
  score?: number | string | null;
  soil_score?: number | string | null;
  vdp_score?: number | string | null;
  rain_score?: number | string | null;
  vpd?: number | string | null;
  duration_estimate?: number | string | null;
  pump_status?: boolean | string | number | null;
  led_status?: boolean | string | number | null;
  device_mode?: 'manual' | 'auto' | string | null;
  wifi_status?: string | null;
  threshold_kritis?: number | string | null;
  threshold_atas?: number | string | null;
  threshold_bawah?: number | string | null;
  watering_time?: string | null;
  watering_duration?: number | string | null;
  schedule_enabled?: boolean | string | number | null;
  created_at?: string | null;
  updatedAt?: string | null;
  sourceTopic?: string | null;
  plant_phase?: 'vegetatif' | 'generatif' | string | null;
  soil_threshold_low?: number | string | null;
  soil_threshold_high?: number | string | null;
  soil_threshold_critical?: number | string | null;
  temp_threshold_low?: number | string | null;
  temp_threshold_high?: number | string | null;
}

interface SensorSnapshotResponse {
  device_id?: string;
  temperature?: number;
  humidity?: number;
  soil_moisture?: number;
  rain?: number;
  score?: number;
  soil_score?: number;
  vdp_score?: number;
  rain_score?: number;
  vpd?: number;
  duration_estimate?: number;
  pump_status?: boolean;
  led_status?: boolean;
  device_mode?: 'manual' | 'auto' | null;
  wifi_status?: string | null;
  threshold_kritis?: number | null;
  threshold_atas?: number | null;
  threshold_bawah?: number | null;
  watering_time?: string | null;
  watering_duration?: number | null;
  schedule_enabled?: boolean;
  created_at?: string | null;
  updatedAt?: string | null;
  sourceTopic?: string | null;
  plant_phase?: 'vegetatif' | 'generatif' | null;
  soil_threshold_low?: number | null;
  soil_threshold_high?: number | null;
  soil_threshold_critical?: number | null;
  temp_threshold_low?: number | null;
  temp_threshold_high?: number | null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
}

function safePhase(value: unknown): 'vegetatif' | 'generatif' | null | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
}

function normalizeSensorContext(input: unknown): SensorSnapshotContext | null {
  if (!input || typeof input !== 'object') return null;

  const sensor = input as SensorSnapshotApi;

  return {
    device_id: typeof sensor.device_id === 'string' && sensor.device_id.trim() ? sensor.device_id.trim() : undefined,
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
    device_mode: sensor.device_mode === 'auto' || sensor.device_mode === 'manual' ? sensor.device_mode : null,
    wifi_status: typeof sensor.wifi_status === 'string' && sensor.wifi_status.trim() ? sensor.wifi_status.trim() : null,
    threshold_kritis: safeNumber(sensor.threshold_kritis),
    threshold_atas: safeNumber(sensor.threshold_atas),
    threshold_bawah: safeNumber(sensor.threshold_bawah),
    watering_time: typeof sensor.watering_time === 'string' ? sensor.watering_time : null,
    watering_duration: safeNumber(sensor.watering_duration),
    schedule_enabled: safeBoolean(sensor.schedule_enabled),
    created_at: typeof sensor.created_at === 'string' ? sensor.created_at : null,
    updatedAt: typeof sensor.updatedAt === 'string' ? sensor.updatedAt : null,
    sourceTopic: typeof sensor.sourceTopic === 'string' ? sensor.sourceTopic : null,
    plant_phase: safePhase(sensor.plant_phase),
    soil_threshold_low: safeNumber(sensor.soil_threshold_low),
    soil_threshold_high: safeNumber(sensor.soil_threshold_high),
    soil_threshold_critical: safeNumber(sensor.soil_threshold_critical),
    temp_threshold_low: safeNumber(sensor.temp_threshold_low),
    temp_threshold_high: safeNumber(sensor.temp_threshold_high),
  };
}

async function fetchLatestSensorSnapshot(): Promise<SensorSnapshotContext | null> {
  try {
    const response = await fetch(SENSOR_ENDPOINT, { headers: buildApiHeaders() });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as SensorSnapshotResponse | null;
    if (!payload || typeof payload !== 'object') return null;
    return normalizeSensorContext(payload);
  } catch {
    return null;
  }
}

function normalizeStatusPayload(payload: unknown): OpenRouterStatus | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Partial<OpenRouterStatus>;
  if (!obj.state || !obj.label || !obj.detail) return null;

  return {
    state: obj.state,
    label: obj.label,
    detail: obj.detail,
    checkedAt: obj.checkedAt,
  };
}

export async function checkOpenRouterConnection(): Promise<OpenRouterStatus> {
  try {
    const response = await fetch(OPENROUTER_STATUS_ENDPOINT, { headers: buildApiHeaders() });
    const payload = await response.json().catch(() => null);
    const normalized = normalizeStatusPayload(payload);
    if (!response.ok || !normalized) {
      throw new Error(normalized?.detail || `OpenRouter status gagal (${response.status})`);
    }
    return normalized;
  } catch (error) {
    return {
      state: 'error',
      label: 'OpenRouter tidak tersambung',
      detail: error instanceof Error ? error.message : 'Unknown connection error',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function sendMessageToOpenRouter(
  userMessage: string,
  history: OpenRouterChatMessage[],
  sensorContext?: Partial<SensorSnapshotContext> | null,
): Promise<string> {
  const latestSensorSnapshot = await fetchLatestSensorSnapshot();
  const mergedSensorContext = normalizeSensorContext({
    ...latestSensorSnapshot,
    ...(sensorContext || {}),
  });

  const recentHistory = history.slice(-8);
  const lastHistoryItem = recentHistory[recentHistory.length - 1];
  const shouldAppendCurrentMessage =
    !(lastHistoryItem && lastHistoryItem.role === 'user' && lastHistoryItem.content.trim() === userMessage.trim());

  const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
    method: 'POST',
    headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message: userMessage,
      history: shouldAppendCurrentMessage ? recentHistory : recentHistory.slice(0, -1),
      sensorContext: mergedSensorContext,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.detail ||
        `OpenRouter request gagal dengan status ${response.status}`,
    );
  }

  const content = payload?.content ?? payload?.message?.content ?? payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenRouter tidak mengembalikan jawaban yang valid.');
  }

  return content.trim();
}
