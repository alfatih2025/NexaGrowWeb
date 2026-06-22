import mqtt, { type MqttClient } from 'mqtt';

const BROKER_URL = (import.meta.env.VITE_BROKER_URL as string | undefined)?.trim() ?? '';
const MQTT_USERNAME = (import.meta.env.VITE_MQTT_USERNAME as string | undefined)?.trim() ?? '';
const MQTT_PASSWORD = (import.meta.env.VITE_MQTT_PASSWORD as string | undefined)?.trim() ?? '';

const WEB_STATUS_TOPIC = 'sproutai/web/status';
const DEVICE_STATUS_TOPIC = 'sproutai/esp32/status';
const SYSTEM_STATUS_TOPIC = 'sproutai/system/status';

const TOPIC_POMPA_CMD = 'sproutai/pompa/cmd';
const TOPIC_POMPA_STATUS = 'sproutai/pompa/status';
const TOPIC_LAMPU_CMD = 'sproutai/lampu/cmd';
const TOPIC_LAMPU_STATUS = 'sproutai/lampu/status';
const TOPIC_MODE_CMD = 'sproutai/mode/cmd';
const TOPIC_MODE_STATUS = 'sproutai/mode/status';
const TOPIC_WIFI_CMD = 'sproutai/wifi/cmd';
const TOPIC_WIFI_STATUS = 'sproutai/wifi/status';
const TOPIC_SCHEDULE_CMD = 'sproutai/schedule/cmd';
const TOPIC_SCHEDULE_STATUS = 'sproutai/schedule/status';
const TOPIC_SENSOR_JSON = 'sproutai/sensor/data';
const TOPIC_SOIL = 'sproutai/sensor/soil';
const TOPIC_TEMP = 'sproutai/sensor/temp';
const TOPIC_HUMIDITY = 'sproutai/sensor/humidity';
const TOPIC_SCORE = 'sproutai/sensor/score';

const SUBSCRIBE_TOPICS = [
  DEVICE_STATUS_TOPIC,
  SYSTEM_STATUS_TOPIC,
  TOPIC_SENSOR_JSON,
  TOPIC_SOIL,
  TOPIC_TEMP,
  TOPIC_HUMIDITY,
  TOPIC_SCORE,
  TOPIC_POMPA_STATUS,
  TOPIC_LAMPU_STATUS,
  TOPIC_MODE_STATUS,
  TOPIC_WIFI_STATUS,
  TOPIC_SCHEDULE_STATUS,
];

const ESP_ONLINE_TIMEOUT_MS = 15_000;
const HISTORY_LIMIT = 120;

export interface MqttSensorSnapshot {
  device_id: string | null;
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  rain: number | null;
  score: number | null;
  soil_score: number | null;
  vdp_score: number | null;
  rain_score: number | null;
  vpd: number | null;
  duration_estimate: number | null;
  pump_status: boolean;
  led_status: boolean;
  device_mode: 'manual' | 'auto' | null;
  wifi_status: string | null;
  threshold_kritis: number | null;
  threshold_atas: number | null;
  threshold_bawah: number | null;
  watering_time: string | null;
  watering_duration: number | null;
  schedule_enabled: boolean;
  updatedAt: string | null;
  sourceTopic: string | null;
}

export interface MqttStatusSnapshot {
  brokerUrl: string;
  browserOnline: boolean;
  mqttConnected: boolean;
  mqttConnecting: boolean;
  mqttReconnecting: boolean;
  mqttError: string | null;
  espOnline: boolean;
  espLastSeenAt: string | null;
  systemOnline: boolean;
  systemLabel: string;
  systemDetail: string;
  lastTopic: string | null;
  lastPayload: string | null;
  lastMessageAt: string | null;
  webPublishedAt: string | null;
  subscribedTopics: string[];
  sensorSnapshot: MqttSensorSnapshot | null;
}

type SensorDelta = Partial<Omit<MqttSensorSnapshot, 'updatedAt' | 'sourceTopic'>>;

let client: MqttClient | null = null;
const listeners = new Set<() => void>();

const emptySensorSnapshot: MqttSensorSnapshot = {
  device_id: null,
  temperature: null,
  humidity: null,
  soil_moisture: null,
  rain: null,
  score: null,
  soil_score: null,
  vdp_score: null,
  rain_score: null,
  vpd: null,
  duration_estimate: null,
  pump_status: false,
  led_status: false,
  device_mode: null,
  wifi_status: null,
  threshold_kritis: null,
  threshold_atas: null,
  threshold_bawah: null,
  watering_time: null,
  watering_duration: null,
  schedule_enabled: true,
  updatedAt: null,
  sourceTopic: null,
};

const defaultSnapshot = (): MqttStatusSnapshot => ({
  brokerUrl: BROKER_URL,
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  mqttConnected: false,
  mqttConnecting: Boolean(BROKER_URL),
  mqttReconnecting: false,
  mqttError: BROKER_URL ? null : 'VITE_BROKER_URL belum diisi',
  espOnline: false,
  espLastSeenAt: null,
  systemOnline: false,
  systemLabel: 'Sistem Offline',
  systemDetail: 'Koneksi belum tersedia',
  lastTopic: null,
  lastPayload: null,
  lastMessageAt: null,
  webPublishedAt: null,
  subscribedTopics: SUBSCRIBE_TOPICS,
  sensorSnapshot: null,
});

let snapshot: MqttStatusSnapshot = defaultSnapshot();
let sensorSnapshot: MqttSensorSnapshot | null = null;
let sensorHistory: MqttSensorSnapshot[] = [];
let reconnectTimer: number | null = null;

function emit() {
  const lastSeen = snapshot.espLastSeenAt ? new Date(snapshot.espLastSeenAt).getTime() : 0;
  const espOnline = Boolean(lastSeen && Date.now() - lastSeen <= ESP_ONLINE_TIMEOUT_MS);
  const systemOnline = snapshot.browserOnline && snapshot.mqttConnected && espOnline;
  const reasonParts: string[] = [];

  if (!snapshot.browserOnline) reasonParts.push('Web offline');
  if (!snapshot.mqttConnected) reasonParts.push(snapshot.mqttError || 'MQTT belum terhubung');
  if (!espOnline) reasonParts.push('ESP32 offline');

  snapshot = {
    ...snapshot,
    espOnline,
    systemOnline,
    systemLabel: systemOnline ? 'Sistem Online' : 'Sistem Offline',
    systemDetail: systemOnline
      ? 'Web, MQTT, dan ESP32 aktif'
      : reasonParts.filter(Boolean).join(' • ') || 'Sistem belum siap',
    sensorSnapshot,
  };

  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Partial<MqttStatusSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

function pushHistory(entry: MqttSensorSnapshot) {
  sensorHistory = [...sensorHistory, entry].slice(-HISTORY_LIMIT);
}

function setSensorSnapshot(next: SensorDelta, sourceTopic: string, force = false) {
  const now = new Date().toISOString();
  const base = sensorSnapshot ?? emptySensorSnapshot;
  const merged: MqttSensorSnapshot = {
    ...base,
    ...next,
    updatedAt: now,
    sourceTopic,
  };

  const comparableBase = {
    ...base,
    updatedAt: null,
    sourceTopic: null,
  };

  const comparableNext = {
    ...merged,
    updatedAt: null,
    sourceTopic: null,
  };

  const changed = force || JSON.stringify(comparableBase) !== JSON.stringify(comparableNext);
  if (!changed) {
    snapshot = {
      ...snapshot,
      lastTopic: sourceTopic,
      lastPayload: null,
      lastMessageAt: now,
      espLastSeenAt: now,
    };
    emit();
    return;
  }

  sensorSnapshot = merged;
  pushHistory(merged);
  snapshot = {
    ...snapshot,
    lastTopic: sourceTopic,
    lastPayload: JSON.stringify(merged),
    lastMessageAt: now,
    espLastSeenAt: now,
    sensorSnapshot,
  };
  emit();
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }
  return undefined;
}

function parseMode(value: unknown): 'manual' | 'auto' | null | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'manual' || normalized === 'auto') return normalized;
  return undefined;
}

function normalizeJsonSensorPayload(payload: string): SensorDelta | null {
  try {
    const obj = JSON.parse(payload);
    if (!obj || typeof obj !== 'object') return null;

    return {
      device_id: typeof obj.device_id === 'string' ? obj.device_id : undefined,
      temperature: parseNumeric(obj.temperature ?? obj.suhu),
      humidity: parseNumeric(obj.humidity ?? obj.kelembapan_udara),
      soil_moisture: parseNumeric(obj.soil_moisture ?? obj.soil ?? obj.tanah),
      rain: parseNumeric(obj.rain ?? obj.hujan),
      score: parseNumeric(obj.score ?? obj.score_total ?? obj.skor),
      soil_score: parseNumeric(obj.soil_score ?? obj.skor_tanah),
      vdp_score: parseNumeric(obj.vdp_score ?? obj.skor_vdp),
      rain_score: parseNumeric(obj.rain_score ?? obj.skor_hujan),
      vpd: parseNumeric(obj.vpd),
      duration_estimate: parseNumeric(obj.duration_estimate ?? obj.duration ?? obj.durasi),
      pump_status: parseBoolean(obj.pump_status),
      led_status: parseBoolean(obj.led_status ?? obj.feeder_status),
      device_mode: parseMode(obj.device_mode),
      wifi_status: typeof obj.wifi_status === 'string' ? obj.wifi_status : undefined,
      threshold_kritis: parseNumeric(obj.threshold_kritis),
      threshold_atas: parseNumeric(obj.threshold_atas),
      threshold_bawah: parseNumeric(obj.threshold_bawah),
      watering_time: typeof obj.watering_time === 'string' ? obj.watering_time : undefined,
      watering_duration: parseNumeric(obj.watering_duration),
      schedule_enabled: parseBoolean(obj.schedule_enabled),
    };
  } catch {
    return null;
  }
}

function updateFromTopic(topic: string, payload: string) {
  const now = new Date().toISOString();
  const trimmed = payload.trim();

  if (topic === SYSTEM_STATUS_TOPIC || topic === DEVICE_STATUS_TOPIC) {
    const lower = trimmed.toLowerCase();
    if (['offline', 'disconnected', 'false', '0'].includes(lower)) {
      setSnapshot({
        espOnline: false,
        espLastSeenAt: null,
        lastTopic: topic,
        lastPayload: payload,
        lastMessageAt: now,
      });
      return;
    }

    setSnapshot({
      espLastSeenAt: now,
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
    });
    return;
  }

  if (topic === TOPIC_SENSOR_JSON) {
    const parsed = normalizeJsonSensorPayload(payload);
    if (parsed) {
      setSensorSnapshot(parsed, topic, true);
      setSnapshot({
        lastTopic: topic,
        lastPayload: payload,
        lastMessageAt: now,
      });
    }
    return;
  }

  if (topic === TOPIC_SOIL) {
    const value = parseNumeric(trimmed);
    if (value !== null) setSensorSnapshot({ soil_moisture: value }, topic);
  } else if (topic === TOPIC_TEMP) {
    const value = parseNumeric(trimmed);
    if (value !== null) setSensorSnapshot({ temperature: value }, topic);
  } else if (topic === TOPIC_HUMIDITY) {
    const value = parseNumeric(trimmed);
    if (value !== null) setSensorSnapshot({ humidity: value }, topic);
  } else if (topic === TOPIC_SCORE) {
    const value = parseNumeric(trimmed);
    if (value !== null) setSensorSnapshot({ score: value }, topic);
  } else if (topic === TOPIC_POMPA_STATUS) {
    const value = parseBoolean(trimmed);
    if (value !== undefined) setSensorSnapshot({ pump_status: value }, topic);
  } else if (topic === TOPIC_LAMPU_STATUS) {
    const value = parseBoolean(trimmed);
    if (value !== undefined) setSensorSnapshot({ led_status: value }, topic);
  } else if (topic === TOPIC_MODE_STATUS) {
    const mode = parseMode(trimmed);
    if (mode !== undefined) setSensorSnapshot({ device_mode: mode }, topic);
  } else if (topic === TOPIC_WIFI_STATUS) {
    setSensorSnapshot({ wifi_status: trimmed || null }, topic);
  } else if (topic === TOPIC_SCHEDULE_STATUS) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        setSensorSnapshot({
          watering_time: typeof parsed.watering_time === 'string' ? parsed.watering_time : undefined,
          watering_duration: parseNumeric(parsed.watering_duration),
          schedule_enabled: parseBoolean(parsed.schedule_enabled),
        }, topic);
      }
    } catch {
      // ignore non-JSON schedule messages
    }
  }

  if (
    topic.startsWith('sproutai/sensor/') ||
    topic.startsWith('sproutai/pompa/') ||
    topic.startsWith('sproutai/lampu/') ||
    topic.startsWith('sproutai/mode/') ||
    topic.startsWith('sproutai/wifi/') ||
    topic.startsWith('sproutai/schedule/') ||
    topic.startsWith('sproutai/esp32/')
  ) {
    setSnapshot({
      lastTopic: topic,
      lastPayload: payload,
      lastMessageAt: now,
      espLastSeenAt: now,
    });
  }
}

function connectOnce() {
  if (client || !BROKER_URL) return client;

  if (!isWebSocketBroker(BROKER_URL)) {
    setSnapshot({
      mqttError: 'VITE_BROKER_URL harus ws:// atau wss:// untuk browser.',
      mqttConnecting: false,
    });
    return null;
  }

  client = mqtt.connect(BROKER_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    reconnectPeriod: 1000,
    connectTimeout: 6000,
    clean: true,
    keepalive: 15,
    clientId: `nexagrow_web_${Math.random().toString(16).slice(2, 10)}`,
  });

  client.on('connect', () => {
    setSnapshot({
      mqttConnected: true,
      mqttConnecting: false,
      mqttReconnecting: false,
      mqttError: null,
    });

    for (const topic of SUBSCRIBE_TOPICS) {
      client?.subscribe(topic, { qos: 1 });
    }

    announceWebPresence('online').catch(() => {});
    setSnapshot({ webPublishedAt: new Date().toISOString() });
  });

  client.on('reconnect', () => {
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: true,
      mqttReconnecting: true,
    });
  });

  client.on('offline', () => {
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: false,
      mqttReconnecting: false,
    });
  });

  client.on('close', () => {
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: false,
    });
  });

  client.on('error', (err: Error) => {
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: false,
      mqttError: err.message,
    });
  });

  client.on('message', (topic: string, message: Buffer) => {
    updateFromTopic(topic, message.toString());
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (client?.connected) {
        client.publish(
          WEB_STATUS_TOPIC,
          JSON.stringify({
            device: 'sprout-web',
            status: 'offline',
            at: new Date().toISOString(),
          }),
          { retain: true, qos: 0 },
        );
      }
    });
  }

  return client;
}

function isWebSocketBroker(url: string) {
  return /^wss?:\/\//i.test(url);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setSnapshot({ browserOnline: true }));
  window.addEventListener('offline', () => setSnapshot({ browserOnline: false }));
  window.setInterval(() => emit(), 3000);
}

export function getMqttClient() {
  return connectOnce();
}

export function getMqttStatusSnapshot() {
  return snapshot;
}

export function getSensorSnapshot() {
  return snapshot.sensorSnapshot;
}

export function getSensorHistorySnapshot() {
  return sensorHistory.slice();
}

export function subscribeMqttStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishMqtt(
  topic: string,
  payload: string,
  options: Record<string, unknown> = {},
) {
  const currentClient = connectOnce();
  if (!currentClient) {
    return Promise.reject(new Error('MQTT client belum tersedia'));
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('MQTT publish timeout'));
    }, 7000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      currentClient.off('connect', onConnect);
      currentClient.off('error', onError);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onConnect = () => {
      currentClient.publish(
        topic,
        payload,
        { qos: 1, retain: false, ...options },
        (err: Error | null | undefined) => {
          cleanup();
          if (err) {
            reject(err);
            return;
          }

          snapshot = {
            ...snapshot,
            lastTopic: topic,
            lastPayload: payload,
            lastMessageAt: new Date().toISOString(),
          };
          emit();
          resolve();
        },
      );
    };

    if (currentClient.connected) {
      onConnect();
      return;
    }

    currentClient.once('connect', onConnect);
    currentClient.once('error', onError);
  });
}

function applyLocalSnapshot(action: string, duration?: number, data?: Record<string, any>) {
  const now = new Date().toISOString();

  switch (action) {
    case 'pump_on':
      setSensorSnapshot({ pump_status: true }, TOPIC_POMPA_STATUS, true);
      break;
    case 'pump_off':
      setSensorSnapshot({ pump_status: false }, TOPIC_POMPA_STATUS, true);
      break;
    case 'pump_10s':
      setSensorSnapshot({ pump_status: true }, TOPIC_POMPA_STATUS, true);
      break;
    case 'led_on':
      setSensorSnapshot({ led_status: true }, TOPIC_LAMPU_STATUS, true);
      break;
    case 'led_off':
      setSensorSnapshot({ led_status: false }, TOPIC_LAMPU_STATUS, true);
      break;
    case 'mode_auto':
      setSensorSnapshot({ device_mode: 'auto' }, TOPIC_MODE_STATUS, true);
      break;
    case 'mode_manual':
      setSensorSnapshot({ device_mode: 'manual' }, TOPIC_MODE_STATUS, true);
      break;
    case 'schedule_set':
      setSensorSnapshot({
        watering_time: typeof data?.watering_time === 'string' ? data.watering_time : undefined,
        watering_duration: parseNumeric(data?.watering_duration),
        schedule_enabled: data?.schedule_enabled === undefined ? undefined : Boolean(data.schedule_enabled),
      }, TOPIC_SCHEDULE_STATUS, true);
      break;
    default:
      break;
  }

  setSnapshot({
    lastTopic: action,
    lastPayload: data ? JSON.stringify(data) : duration != null ? String(duration) : action,
    lastMessageAt: now,
  });
}

export function syncLocalControlState(action: string, duration?: number, data?: Record<string, any>) {
  applyLocalSnapshot(action, duration, data);
}

export function announceWebPresence(status: 'online' | 'offline' = 'online') {
  const currentClient = connectOnce();
  if (!currentClient) return Promise.resolve(false);

  const payload = JSON.stringify({
    device: 'sprout-web',
    status,
    at: new Date().toISOString(),
  });

  return new Promise<boolean>((resolve) => {
    currentClient.publish(
      WEB_STATUS_TOPIC,
      payload,
      { retain: true, qos: 0 },
      () => {
        setSnapshot({
          webPublishedAt: new Date().toISOString(),
          lastTopic: WEB_STATUS_TOPIC,
          lastPayload: payload,
          lastMessageAt: new Date().toISOString(),
        });
        resolve(true);
      },
    );
  });
}

export default getMqttClient();
