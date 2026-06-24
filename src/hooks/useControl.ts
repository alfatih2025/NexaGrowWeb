import { useCallback, useEffect, useState } from 'react';
import { getMqttClient, publishMqtt, syncLocalControlState } from '../services/mqtt';

export interface ControlLog {
  id: number;
  action: string;
  device: string;
  duration: number | null;
  status: string;
  executed_at: string;
}

const STORAGE_KEY = 'nexagrow-control-logs';

function readStoredLogs(): ControlLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ControlLog[]) : [];
  } catch {
    return [];
  }
}

function persistStoredLogs(logs: ControlLog[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function createLog(action: string, device: string, duration: number | null, status: string): ControlLog {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    action,
    device,
    duration,
    status,
    executed_at: new Date().toISOString(),
  };
}

function resolveControlCommand(action: string, duration?: number, data?: Record<string, any>) {
  switch (action) {
    case 'pump_on':
      return { topic: 'sproutai/pompa/cmd', payload: 'ON' };
    case 'pump_off':
      return { topic: 'sproutai/pompa/cmd', payload: 'OFF' };
    case 'pump_10s':
      return {
        topic: 'sproutai/ai/action',
        payload: JSON.stringify({
          pump: 'ON',
          duration: duration ?? 10,
        }),
      };
    case 'led_on':
      return { topic: 'sproutai/lampu/cmd', payload: 'ON' };
    case 'led_off':
      return { topic: 'sproutai/lampu/cmd', payload: 'OFF' };
    case 'mode_auto':
      return { topic: 'sproutai/mode/cmd', payload: 'AUTO' };
    case 'mode_manual':
      return { topic: 'sproutai/mode/cmd', payload: 'MANUAL' };
    case 'settings_sync':
      return {
        topic: 'sproutai/settings/cmd',
        payload: JSON.stringify({
          plant_phase: String(data?.plant_phase ?? '').trim(),
          location: String(data?.location ?? '').trim(),
          temp_threshold_low: Number(data?.temp_threshold_low ?? 0),
          temp_threshold_high: Number(data?.temp_threshold_high ?? 0),
          humidity_threshold_low: Number(data?.humidity_threshold_low ?? 0),
          humidity_threshold_high: Number(data?.humidity_threshold_high ?? 0),
          soil_threshold_low: Number(data?.soil_threshold_low ?? 0),
          soil_threshold_high: Number(data?.soil_threshold_high ?? 0),
          soil_threshold_critical: Number(data?.soil_threshold_critical ?? 0),
          watering_time: String(data?.watering_time ?? '').trim(),
          watering_duration: Number(data?.watering_duration ?? 10),
          watering_enabled: Boolean(data?.watering_enabled ?? true),
          auto_report: Boolean(data?.auto_report ?? true),
          report_time: String(data?.report_time ?? '08:00').trim(),
          user_name: String(data?.user_name ?? '').trim(),
          user_email: String(data?.user_email ?? '').trim(),
        }),
      };
    case 'schedule_set':
      return {
        topic: 'sproutai/schedule/cmd',
        payload: JSON.stringify({
          watering_time: String(data?.watering_time ?? '').trim(),
          watering_duration: Number(data?.watering_duration ?? 10),
          schedule_enabled: Boolean(data?.schedule_enabled ?? true),
        }),
      };
    case 'wifi_update': {
      const ssid = String(data?.ssid ?? '').trim();
      const password = String(data?.password ?? '');
      return {
        topic: 'sproutai/wifi/cmd',
        payload: JSON.stringify({ ssid, password }),
      };
    }
    default:
      return null;
  }
}

export function useControl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ControlLog[]>(() => readStoredLogs());

  const pushLog = useCallback((log: ControlLog) => {
    setLogs((prev) => {
      const next = [log, ...prev].slice(0, 50);
      persistStoredLogs(next);
      return next;
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    const stored = readStoredLogs();
    setLogs(stored);
    return stored;
  }, []);

  const sendCommand = useCallback(async (action: string, duration?: number, data?: Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      const client = getMqttClient();
      if (!client) throw new Error('MQTT client belum tersedia');

      const mqttCommand = resolveControlCommand(action, duration, data);
      if (!mqttCommand) throw new Error(`Perintah "${action}" tidak dikenal`);

      if (!client.connected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('MQTT belum terhubung'));
          }, 10_000);

          const cleanup = () => {
            window.clearTimeout(timeout);
            client.off('connect', onConnect);
            client.off('error', onError);
          };

          const onConnect = () => {
            cleanup();
            resolve();
          };

          const onError = (err: Error) => {
            cleanup();
            reject(err);
          };

          client.once('connect', onConnect);
          client.once('error', onError);
        });
      }

      await publishMqtt(mqttCommand.topic, mqttCommand.payload, {
        retain: false,
        qos: 1,
      });

      syncLocalControlState(action, duration, data);
      pushLog(createLog(action, 'ESP32_001', duration ?? null, 'completed'));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      pushLog(createLog(action, 'ESP32_001', duration ?? null, 'failed'));
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [pushLog]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { sendCommand, fetchLogs, logs, loading, error };
}
