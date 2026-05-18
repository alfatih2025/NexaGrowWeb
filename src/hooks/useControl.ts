import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMqttClient, publishMqtt, syncLocalControlState } from '../services/mqtt';

export interface ControlLog {
  id: number;
  action: string;
  device: string;
  duration: number | null;
  status: 'pending' | 'completed' | 'failed' | string;
  executed_at: string;
  command_id?: number;
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

function createLog(
  action: string,
  device: string,
  duration: number | null,
  status: ControlLog['status'],
  command_id?: number,
): ControlLog {
  return {
    id: command_id ?? Date.now() + Math.floor(Math.random() * 1000),
    action,
    device,
    duration,
    status,
    executed_at: new Date().toISOString(),
    command_id,
  };
}

function resolveCurrentDevice(device?: string) {
  return String(device || 'ESP32_001').trim() || 'ESP32_001';
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
    try {
      const response = await fetch('/api/control?limit=50');
      if (!response.ok) throw new Error(`Control logs API gagal (${response.status})`);
      const data = await response.json();
      const next = Array.isArray(data) ? (data as ControlLog[]) : [];
      setLogs(next);
      persistStoredLogs(next);
      return next;
    } catch {
      const stored = readStoredLogs();
      setLogs(stored);
      return stored;
    }
  }, []);

  const resolveLocalCommand = useCallback(
    async (action: string, duration?: number, data?: Record<string, any>) => {
      const device = resolveCurrentDevice(data?.device);
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          device,
          duration: duration ?? null,
          data: data ?? null,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Control API gagal (${response.status})`);
      }
      return payload as {
        success: boolean;
        command_id: number;
        topic: string;
        payload: string;
        action: string;
        device: string;
        duration: number | null;
      };
    },
    [],
  );

  const sendCommand = useCallback(
    async (action: string, duration?: number, data?: Record<string, any>) => {
      setLoading(true);
      setError(null);

      try {
        const command = await resolveLocalCommand(action, duration, data);
        const mqttClient = getMqttClient();
        if (!mqttClient) {
          throw new Error('MQTT client belum tersedia');
        }

        await publishMqtt(command.topic, command.payload, {
          retain: false,
          qos: 1,
        });

        syncLocalControlState(action, duration);

        pushLog(
          createLog(
            action,
            command.device || 'ESP32_001',
            duration ?? null,
            'pending',
            command.command_id,
          ),
        );

        window.setTimeout(() => {
          void fetchLogs();
        }, 2500);

        return {
          success: true,
          command_id: command.command_id,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);

        pushLog(createLog(action, resolveCurrentDevice(data?.device), duration ?? null, 'failed'));
        return {
          success: false,
          error: message,
        };
      } finally {
        setLoading(false);
      }
    },
    [fetchLogs, pushLog, resolveLocalCommand],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { sendCommand, fetchLogs, logs, loading, error };
}
