import { useState, useEffect, useCallback, useRef } from 'react';
import { getSensorSnapshot, subscribeMqttStatus, type MqttSensorSnapshot } from '../services/mqtt';

export interface SensorData {
  id?: number;
  device_id: string;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  rain?: number | null;
  score?: number | null;
  soil_score?: number | null;
  vdp_score?: number | null;
  rain_score?: number | null;
  vpd?: number | null;
  duration_estimate?: number | null;
  pump_status: boolean;
  led_status?: boolean;
  device_mode?: 'manual' | 'auto' | null;
  wifi_status: string;
  threshold_kritis?: number | null;
  threshold_atas?: number | null;
  threshold_bawah?: number | null;
  watering_time?: string | null;
  watering_duration?: number | null;
  schedule_enabled?: boolean;
  formula_name?: string | null;
  formula_soil?: string | null;
  formula_vpd?: string | null;
  formula_score?: string | null;
  soil_raw_dry?: number | null;
  created_at: string;
}

function toNumber(value: unknown, fallback: number | null = null): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }
  return fallback;
}

function buildFallbackData(): SensorData {
  return {
    device_id: 'ESP32_001',
    temperature: 0,
    humidity: 0,
    soil_moisture: 0,
    rain: 0,
    score: 0,
    soil_score: 0,
    vdp_score: 0,
    rain_score: 0,
    vpd: 0,
    duration_estimate: 0,
    pump_status: false,
    led_status: false,
    device_mode: null,
    wifi_status: 'unknown',
    threshold_kritis: null,
    threshold_atas: null,
    threshold_bawah: null,
    watering_time: null,
    watering_duration: null,
    schedule_enabled: true,
    formula_name: null,
    formula_soil: null,
    formula_vpd: null,
    formula_score: null,
    soil_raw_dry: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeSensorDataRow(row: any): SensorData | null {
  if (!row || typeof row !== 'object') return null;
  const fallback = buildFallbackData();

  return {
    id: row.id ?? undefined,
    device_id: row.device_id ?? fallback.device_id,
    temperature: (toNumber(row.temperature, fallback.temperature) ?? fallback.temperature) as number,
    humidity: (toNumber(row.humidity, fallback.humidity) ?? fallback.humidity) as number,
    soil_moisture: (toNumber(row.soil_moisture ?? row.soil ?? row.tanah, fallback.soil_moisture) ?? fallback.soil_moisture) as number,
    rain: toNumber(row.rain ?? row.hujan, fallback.rain),
    score: toNumber(row.score ?? row.score_total ?? row.skor, fallback.score),
    soil_score: toNumber(row.soil_score ?? row.skor_tanah, fallback.soil_score),
    vdp_score: toNumber(row.vdp_score ?? row.skor_vdp, fallback.vdp_score),
    rain_score: toNumber(row.rain_score ?? row.skor_hujan, fallback.rain_score),
    vpd: toNumber(row.vpd, fallback.vpd),
    duration_estimate: toNumber(row.duration_estimate ?? row.duration ?? row.durasi, fallback.duration_estimate),
    pump_status: toBoolean(row.pump_status, fallback.pump_status),
    led_status: toBoolean(row.led_status ?? row.feeder_status, fallback.led_status),
    device_mode: row.device_mode === 'auto' || row.device_mode === 'manual' ? row.device_mode : null,
    wifi_status: row.wifi_status ?? fallback.wifi_status,
    threshold_kritis: toNumber(row.threshold_kritis, fallback.threshold_kritis),
    threshold_atas: toNumber(row.threshold_atas, fallback.threshold_atas),
    threshold_bawah: toNumber(row.threshold_bawah, fallback.threshold_bawah),
    watering_time: typeof row.watering_time === 'string' ? row.watering_time : null,
    watering_duration: toNumber(row.watering_duration, fallback.watering_duration),
    schedule_enabled: toBoolean(row.schedule_enabled, fallback.schedule_enabled),
    formula_name: typeof row.formula_name === 'string' ? row.formula_name : null,
    formula_soil: typeof row.formula_soil === 'string' ? row.formula_soil : null,
    formula_vpd: typeof row.formula_vpd === 'string' ? row.formula_vpd : null,
    formula_score: typeof row.formula_score === 'string' ? row.formula_score : null,
    soil_raw_dry: toNumber(row.soil_raw_dry, fallback.soil_raw_dry),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function mergeSensorData(base: SensorData | null, live: MqttSensorSnapshot | null): SensorData | null {
  if (!base && !live) return null;
  const fallback = base ?? buildFallbackData();

  return {
    ...fallback,
    device_id: live?.device_id ?? fallback.device_id,
    temperature: live?.temperature ?? fallback.temperature,
    humidity: live?.humidity ?? fallback.humidity,
    soil_moisture: live?.soil_moisture ?? fallback.soil_moisture,
    rain: live?.rain ?? fallback.rain,
    score: live?.score ?? fallback.score,
    soil_score: live?.soil_score ?? fallback.soil_score,
    vdp_score: live?.vdp_score ?? fallback.vdp_score,
    rain_score: live?.rain_score ?? fallback.rain_score,
    vpd: live?.vpd ?? fallback.vpd,
    duration_estimate: live?.duration_estimate ?? fallback.duration_estimate,
    pump_status: live?.pump_status ?? fallback.pump_status,
    led_status: live?.led_status ?? fallback.led_status,
    device_mode: live?.device_mode ?? fallback.device_mode,
    wifi_status: live?.wifi_status ?? fallback.wifi_status,
    threshold_kritis: live?.threshold_kritis ?? fallback.threshold_kritis,
    threshold_atas: live?.threshold_atas ?? fallback.threshold_atas,
    threshold_bawah: live?.threshold_bawah ?? fallback.threshold_bawah,
    watering_time: live?.watering_time ?? fallback.watering_time,
    watering_duration: live?.watering_duration ?? fallback.watering_duration,
    schedule_enabled: live?.schedule_enabled ?? fallback.schedule_enabled,
    formula_name: live?.formula_name ?? fallback.formula_name,
    formula_soil: live?.formula_soil ?? fallback.formula_soil,
    formula_vpd: live?.formula_vpd ?? fallback.formula_vpd,
    formula_score: live?.formula_score ?? fallback.formula_score,
    soil_raw_dry: live?.soil_raw_dry ?? fallback.soil_raw_dry,
    created_at: live?.updatedAt ?? fallback.created_at,
  };
}

export function useSensorData(pollInterval = 3000) {
  const [data, setData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastDataRef = useRef<SensorData | null>(null);

  const mergeWithLiveSnapshot = useCallback((next: SensorData | null) => {
    const live = getSensorSnapshot();
    return mergeSensorData(next ?? lastDataRef.current, live);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        fetch('/api/sensor?latest=true'),
        fetch('/api/sensor?limit=60'),
      ]);

      if (!latestRes.ok || !historyRes.ok) {
        throw new Error('Failed to fetch sensor data');
      }

      const latest = await latestRes.json().catch(() => null);
      const historyData = await historyRes.json().catch(() => []);

      const normalizedLatest = mergeWithLiveSnapshot(normalizeSensorDataRow(latest));
      if (normalizedLatest) {
        lastDataRef.current = normalizedLatest;
        setData(normalizedLatest);
      }

      setHistory(Array.isArray(historyData) ? historyData.map(normalizeSensorDataRow).filter(Boolean) as SensorData[] : []);
      setError(null);
    } catch (err) {
      const fallback = mergeWithLiveSnapshot(lastDataRef.current);
      if (fallback) {
        lastDataRef.current = fallback;
        setData(fallback);
      }
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
      setData((prev) => {
        const merged = mergeSensorData(prev ?? lastDataRef.current, live);
        if (merged) lastDataRef.current = merged;
        return merged;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { data, history, loading, error, refetch: fetchData };
}
