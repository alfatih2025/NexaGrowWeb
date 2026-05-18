import { useState, useEffect, useCallback } from 'react';
import { getSensorSnapshot, subscribeMqttStatus } from '../services/mqtt';

export interface SensorData {
  id?: number;
  device_id: string;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  pump_status: boolean;
  led_status?: boolean;
  device_mode?: 'manual' | 'auto' | null;
  wifi_status: string;
  created_at: string;
}

function buildFallbackData(): SensorData {
  return {
    device_id: 'ESP32_001',
    temperature: 0,
    humidity: 0,
    soil_moisture: 0,
    pump_status: false,
    led_status: false,
    device_mode: null,
    wifi_status: 'unknown',
    created_at: new Date().toISOString(),
  };
}

function mergeSensorData(base: SensorData | null, live: ReturnType<typeof getSensorSnapshot>): SensorData | null {
  if (!base && !live) return null;

  const fallback = base ?? buildFallbackData();

  return {
    ...fallback,
    temperature: live?.temperature ?? fallback.temperature,
    humidity: live?.humidity ?? fallback.humidity,
    soil_moisture: live?.soil_moisture ?? fallback.soil_moisture,
    pump_status: live?.pump_status ?? fallback.pump_status,
    led_status: live?.led_status ?? fallback.led_status,
    device_mode: live?.device_mode ?? fallback.device_mode,
    wifi_status: live?.wifi_status ?? fallback.wifi_status,
    created_at: live?.updatedAt ?? fallback.created_at,
  };
}

export function useSensorData(pollInterval = 5000) {
  const [data, setData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mergeWithLiveSnapshot = useCallback((next: SensorData | null) => {
    const live = getSensorSnapshot();
    return mergeSensorData(next, live);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        fetch('/api/sensor?latest=true'),
        fetch('/api/sensor?limit=50'),
      ]);

      if (!latestRes.ok || !historyRes.ok) {
        throw new Error('Failed to fetch sensor data');
      }

      const latest = await latestRes.json().catch(() => null);
      const historyData = await historyRes.json().catch(() => []);

      setData(mergeWithLiveSnapshot(latest));
      setHistory(Array.isArray(historyData) ? historyData : []);
      setError(null);
    } catch (err) {
      const fallback = mergeWithLiveSnapshot(null);
      if (fallback) setData(fallback);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [mergeWithLiveSnapshot]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  useEffect(() => {
    const unsubscribe = subscribeMqttStatus(() => {
      const live = getSensorSnapshot();
      if (!live) return;
      setData((prev) => mergeSensorData(prev, live));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { data, history, loading, error, refetch: fetchData };
}
