import { useCallback, useEffect, useState } from 'react';
import { useMqttStatus } from './useMqttStatus';
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

function createFallbackLog(action: string, device: string, duration: number | null, status: string): ControlLog {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    action,
    device,
    duration,
    status,
    executed_at: new Date().toISOString(),
  };
}

function resolveLocalLogResponse(log: any, fallback: ControlLog): ControlLog {
  if (!log || typeof log !== 'object') return fallback;
  return {
    id: Number(log.id ?? fallback.id),
    action: String(log.action ?? fallback.action),
    device: String(log.device ?? fallback.device),
    duration: log.duration === null || log.duration === undefined ? null : Number(log.duration),
    status: String(log.status ?? fallback.status),
    executed_at: String(log.executed_at ?? fallback.executed_at),
  };
}

async function fetchControlLogs(): Promise<ControlLog[]> {
  const response = await fetch('/api/control?limit=50');
  if (!response.ok) throw new Error(`Failed to fetch control logs (${response.status})`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export function useControl() {
  const mqttStatus = useMqttStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ControlLog[]>(() => readStoredLogs());

  const pushLogs = useCallback((nextLogs: ControlLog[]) => {
    setLogs(nextLogs);
    persistStoredLogs(nextLogs);
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const apiLogs = await fetchControlLogs();
      pushLogs(apiLogs as ControlLog[]);
      setError(null);
      return apiLogs as ControlLog[];
    } catch {
      const stored = readStoredLogs();
      pushLogs(stored);
      return stored;
    }
  }, [pushLogs]);

  const sendCommand = useCallback(async (action: string, duration?: number, data?: Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          duration: duration ?? null,
          device: data?.device || 'ESP32_001',
          data,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Control API gagal (${response.status})`);
      }

      const fallback = createFallbackLog(action, data?.device || 'ESP32_001', duration ?? null, 'pending');
      const resolvedLog = resolveLocalLogResponse(payload?.log, fallback);
      pushLogs([resolvedLog, ...logs.filter((item) => item.id !== resolvedLog.id)]);

      const mqttClient = getMqttClient();
      if (!mqttClient) {
        throw new Error('MQTT client belum tersedia');
      }
      if (!payload?.topic || !payload?.payload_json) {
        throw new Error('Payload MQTT tidak tersedia');
      }

      await publishMqtt(payload.topic, payload.payload_json, { retain: false, qos: 1 });
      syncLocalControlState(action, duration);

      setTimeout(() => {
        fetchLogs().catch(() => {});
      }, 1500);

      return { success: true, command_id: payload.command_id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      const fallback = createFallbackLog(action, data?.device || 'ESP32_001', duration ?? null, 'failed');
      pushLogs([fallback, ...logs]);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchLogs, logs, pushLogs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (mqttStatus.lastTopic === 'sproutai/control/ack') {
      fetchLogs().catch(() => {});
    }
  }, [fetchLogs, mqttStatus.lastTopic]);

  return { sendCommand, fetchLogs, logs, loading, error };
}
