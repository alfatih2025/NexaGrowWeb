import mqtt, { type MqttClient } from 'mqtt';

const BROKER_URL = import.meta.env.VITE_BROKER_URL as string | undefined;
const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME as string | undefined;
const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD as string | undefined;

const WEB_STATUS_TOPIC = 'sproutai/web/status';
const SYSTEM_STATUS_TOPIC = 'sproutai/system/status';

const SUBSCRIBE_TOPICS = ['sproutai/#'];
const ESP_ONLINE_TIMEOUT_MS = 30_000;

const TOPIC_POMPA_CMD = 'sproutai/pompa/cmd';
const TOPIC_POMPA_STATUS = 'sproutai/pompa/status';
const TOPIC_LAMPU_CMD = 'sproutai/lampu/cmd';
const TOPIC_LAMPU_STATUS = 'sproutai/lampu/status';
const TOPIC_MODE_CMD = 'sproutai/mode/cmd';
const TOPIC_MODE_STATUS = 'sproutai/mode/status';
const TOPIC_SOIL = 'sproutai/sensor/soil';
const TOPIC_TEMP = 'sproutai/sensor/temp';
const TOPIC_HUMIDITY = 'sproutai/sensor/humidity';
const TOPIC_SENSOR_JSON = 'sproutai/sensor/data';
const TOPIC_WIFI_STATUS = 'sproutai/wifi/status';

export interface MqttSensorSnapshot {
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  pump_status: boolean;
  led_status: boolean;
  device_mode: 'manual' | 'auto' | null;
  wifi_status: string | null;
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

let client: MqttClient | null = null;
const listeners = new Set<() => void>();

const initialSensorSnapshot: MqttSensorSnapshot = {
  temperature: null,
  humidity: null,
  soil_moisture: null,
  pump_status: false,
  led_status: false,
  device_mode: null,
  wifi_status: null,
  updatedAt: null,
  sourceTopic: null,
};

let sensorSnapshot: MqttSensorSnapshot | null = null;

let snapshot: MqttStatusSnapshot = {
  brokerUrl: BROKER_URL ?? '',
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  mqttConnected: false,
  mqttConnecting: Boolean(BROKER_URL),
  mqttReconnecting: false,
  mqttError: BROKER_URL ? null : 'VITE_BROKER_URL belum diisi',
  espOnline: false,
  espLastSeenAt: null,
  systemOnline: false,
  systemLabel: 'Offline',
  systemDetail: 'Koneksi belum tersedia',
  lastTopic: null,
  lastPayload: null,
  lastMessageAt: null,
  webPublishedAt: null,
  subscribedTopics: SUBSCRIBE_TOPICS,
  sensorSnapshot,
};

function computeSystemState(current: MqttStatusSnapshot) {
  const reasons: string[] = [];
  if (!current.browserOnline) reasons.push('Web offline');
  if (!current.mqttConnected) reasons.push(current.mqttError || 'MQTT belum terhubung');
  if (!current.espOnline) reasons.push('ESP32 offline');

  const online = current.browserOnline && current.mqttConnected && current.espOnline;

  return {
    systemOnline: online,
    systemLabel: online ? 'Online' : 'Offline',
    systemDetail: online ? 'Web, MQTT, dan ESP32 aktif' : reasons.join(' • ') || 'Sistem belum siap',
  };
}

function emit() {
  const lastSeen = snapshot.espLastSeenAt ? new Date(snapshot.espLastSeenAt).getTime() : 0;
  const espOnline = Boolean(lastSeen && Date.now() - lastSeen <= ESP_ONLINE_TIMEOUT_MS);
  snapshot = {
    ...snapshot,
    espOnline,
    ...computeSystemState({ ...snapshot, espOnline }),
    sensorSnapshot,
  };
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Partial<MqttStatusSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

function setSensorSnapshot(next: Partial<MqttSensorSnapshot>, markSeenAtTopic: string | null = null) {
  const now = new Date().toISOString();
  const base = sensorSnapshot ?? initialSensorSnapshot;
  sensorSnapshot = {
    ...base,
    ...next,
    updatedAt: next.updatedAt ?? now,
    sourceTopic: markSeenAtTopic ?? next.sourceTopic ?? base.sourceTopic,
  };
  snapshot = {
    ...snapshot,
    espLastSeenAt: now,
    sensorSnapshot,
  };
  emit();
}

function isWebSocketBroker(url: string) {
  return /^wss?:\/\//i.test(url);
}

function parseBooleanPayload(payload: string) {
  const normalized = payload.trim().toLowerCase();
  return normalized === 'on' || normalized === 'true' || normalized === '1';
}

function parseModePayload(payload: string): 'manual' | 'auto' | null {
  const normalized = payload.trim().toLowerCase();
  if (['auto', 'mode_auto', 'automatic', 'otomatis'].includes(normalized)) return 'auto';
  if (['manual', 'mode_manual', 'man', 'manual_mode'].includes(normalized)) return 'manual';
  return null;
}

function parseNumericPayload(payload: string) {
  const value = Number(payload.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function normalizeJsonSensorPayload(payload: string): Partial<MqttSensorSnapshot> | null {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as Record<string, unknown>;
    return {
      temperature: typeof obj.temperature === 'number' ? obj.temperature : Number(obj.temperature ?? NaN),
      humidity: typeof obj.humidity === 'number' ? obj.humidity : Number(obj.humidity ?? NaN),
      soil_moisture: typeof obj.soil_moisture === 'number' ? obj.soil_moisture : Number(obj.soil_moisture ?? NaN),
      pump_status: typeof obj.pump_status === 'boolean' ? obj.pump_status : undefined,
      led_status: typeof obj.led_status === 'boolean' ? obj.led_status : undefined,
      device_mode: obj.device_mode === 'auto' || obj.device_mode === 'manual' ? obj.device_mode : undefined,
      wifi_status: typeof obj.wifi_status === 'string' ? obj.wifi_status : undefined,
    };
  } catch {
    return null;
  }
}

function handleIncomingMessage(topic: string, payload: string) {
  const now = new Date().toISOString();
  const lower = payload.trim().toLowerCase();

  const explicitOffline = ['offline', 'disconnected', 'false', '0'].includes(lower);
  const explicitOnline = ['online', 'connected', 'true', '1'].includes(lower);

  if (topic === WEB_STATUS_TOPIC || topic === SYSTEM_STATUS_TOPIC) {
    if (explicitOffline) {
      setSnapshot({ espOnline: false, espLastSeenAt: null });
      return;
    }
    if (explicitOnline || lower.length > 0) {
      setSnapshot({ espLastSeenAt: now, lastTopic: topic, lastPayload: payload, lastMessageAt: now });
      return;
    }
  }

  if (topic === TOPIC_SENSOR_JSON) {
    const parsed = normalizeJsonSensorPayload(payload);
    if (parsed) {
      setSensorSnapshot({
        temperature: Number.isFinite(parsed.temperature) ? Number(parsed.temperature) : (sensorSnapshot?.temperature ?? null),
        humidity: Number.isFinite(parsed.humidity) ? Number(parsed.humidity) : (sensorSnapshot?.humidity ?? null),
        soil_moisture: Number.isFinite(parsed.soil_moisture) ? Number(parsed.soil_moisture) : (sensorSnapshot?.soil_moisture ?? null),
        pump_status: parsed.pump_status ?? sensorSnapshot?.pump_status ?? false,
        led_status: parsed.led_status ?? sensorSnapshot?.led_status ?? false,
        device_mode: parsed.device_mode ?? sensorSnapshot?.device_mode ?? null,
        wifi_status: parsed.wifi_status ?? sensorSnapshot?.wifi_status ?? null,
        updatedAt: now,
      }, topic);
      setSnapshot({ lastTopic: topic, lastPayload: payload, lastMessageAt: now });
      return;
    }
  }

  if (topic === TOPIC_SOIL) {
    const value = parseNumericPayload(payload);
    if (value !== null) {
      setSensorSnapshot({ soil_moisture: value }, topic);
    }
  } else if (topic === TOPIC_TEMP) {
    const value = parseNumericPayload(payload);
    if (value !== null) {
      setSensorSnapshot({ temperature: value }, topic);
    }
  } else if (topic === TOPIC_HUMIDITY) {
    const value = parseNumericPayload(payload);
    if (value !== null) {
      setSensorSnapshot({ humidity: value }, topic);
    }
  } else if (topic === TOPIC_POMPA_STATUS) {
    setSensorSnapshot({ pump_status: parseBooleanPayload(payload) }, topic);
  } else if (topic === TOPIC_LAMPU_STATUS) {
    setSensorSnapshot({ led_status: parseBooleanPayload(payload) }, topic);
  } else if (topic === TOPIC_MODE_STATUS) {
    const mode = parseModePayload(payload);
    if (mode) setSensorSnapshot({ device_mode: mode }, topic);
  } else if (topic === TOPIC_WIFI_STATUS) {
    setSensorSnapshot({ wifi_status: payload.trim() || null }, topic);
  }

  if (
    topic.startsWith('sproutai/sensor/') ||
    topic.startsWith('sproutai/pompa/') ||
    topic.startsWith('sproutai/lampu/') ||
    topic.startsWith('sproutai/mode/') ||
    topic.startsWith('sproutai/wifi/') ||
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
      mqttError:
        'VITE_BROKER_URL harus ws:// atau wss:// untuk browser. Jangan pakai mqtt:// atau tcp://',
      mqttConnecting: false,
    });
    return null;
  }

  client = mqtt.connect(BROKER_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    clean: true,
    keepalive: 30,
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

    client?.publish(
      WEB_STATUS_TOPIC,
      JSON.stringify({
        device: 'sprout-web',
        status: 'online',
        at: new Date().toISOString(),
      }),
      { retain: true, qos: 0 },
    );

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

  client.on('error', (err) => {
    setSnapshot({
      mqttConnected: false,
      mqttConnecting: false,
      mqttError: err.message,
    });
  });

  client.on('message', (topic, message) => {
    const payload = message.toString();
    handleIncomingMessage(topic, payload);
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

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setSnapshot({ browserOnline: true }));
  window.addEventListener('offline', () => setSnapshot({ browserOnline: false }));
  window.setInterval(() => emit(), 5000);
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
    }, 10_000);

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
        (err) => {
          cleanup();
          if (err) {
            reject(err);
            return;
          }
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

export function syncLocalControlState(action: string, duration?: number) {
  const now = new Date().toISOString();

  switch (action) {
    case 'pump_on':
      setSensorSnapshot({ pump_status: true }, TOPIC_POMPA_STATUS);
      break;
    case 'pump_off':
      setSensorSnapshot({ pump_status: false }, TOPIC_POMPA_STATUS);
      break;
    case 'pump_10s':
      setSensorSnapshot({ pump_status: true }, TOPIC_POMPA_STATUS);
      break;
    case 'led_on':
      setSensorSnapshot({ led_status: true }, TOPIC_LAMPU_STATUS);
      break;
    case 'led_off':
      setSensorSnapshot({ led_status: false }, TOPIC_LAMPU_STATUS);
      break;
    case 'mode_auto':
      setSensorSnapshot({ device_mode: 'auto' }, TOPIC_MODE_STATUS);
      break;
    case 'mode_manual':
      setSensorSnapshot({ device_mode: 'manual' }, TOPIC_MODE_STATUS);
      break;
    default:
      break;
  }

  setSnapshot({
    lastTopic: action,
    lastPayload: duration ? String(duration) : action,
    lastMessageAt: now,
  });
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
      () => resolve(true),
    );
  });
}

export default getMqttClient();
