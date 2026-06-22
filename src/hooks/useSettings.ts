import { useState, useEffect, useCallback } from 'react';
import { buildApiHeaders } from '../lib/apiAuth';
import { getPhaseDefaults, normalizePlantPhase, type PlantPhase } from '../lib/plantPhase';

export interface Settings {
  id: number;
  plant_phase: PlantPhase;
  location: string;
  temp_threshold_high: number;
  temp_threshold_low: number;
  soil_threshold_low: number;
  soil_threshold_high: number;
  soil_threshold_critical: number;
  ph_min: number;
  ph_max: number;
  auto_report: boolean;
  report_time: string;
  watering_time: string;
  watering_duration: number;
  watering_enabled: boolean;
  user_name: string;
  user_email: string;
  // Legacy alias to preserve compatibility with older screens and stored rows.
  crop_mode?: PlantPhase;
  soil_moisture_threshold?: number;
}

const DEFAULT_PHASE = 'vegetatif' as const;
const phaseDefaults = getPhaseDefaults(DEFAULT_PHASE);

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  plant_phase: DEFAULT_PHASE,
  location: 'bmkg',
  temp_threshold_high: phaseDefaults.temp_threshold_high,
  temp_threshold_low: phaseDefaults.temp_threshold_low,
  soil_threshold_low: phaseDefaults.soil_threshold_low,
  soil_threshold_high: phaseDefaults.soil_threshold_high,
  soil_threshold_critical: phaseDefaults.soil_threshold_critical,
  ph_min: 5.5,
  ph_max: 8.0,
  auto_report: true,
  report_time: '08:00',
  watering_time: '06:00',
  watering_duration: 10,
  watering_enabled: true,
  user_name: 'Petani Cerdas',
  user_email: 'petani@sprout.id',
  crop_mode: DEFAULT_PHASE,
  soil_moisture_threshold: phaseDefaults.soil_threshold_low,
};

function toFiniteNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const value = { ...DEFAULT_SETTINGS, ...(input || {}) };
  const phase = normalizePlantPhase((value.plant_phase ?? value.crop_mode) as unknown);
  const defaults = getPhaseDefaults(phase);

  const low = toFiniteNumber(value.soil_threshold_low ?? value.soil_moisture_threshold, defaults.soil_threshold_low);
  const high = toFiniteNumber(value.soil_threshold_high, defaults.soil_threshold_high);
  const critical = toFiniteNumber(value.soil_threshold_critical, defaults.soil_threshold_critical);

  return {
    ...value,
    id: 1,
    plant_phase: phase,
    crop_mode: phase,
    location: String(value.location || DEFAULT_SETTINGS.location).trim() || DEFAULT_SETTINGS.location,
    temp_threshold_high: toFiniteNumber(value.temp_threshold_high, defaults.temp_threshold_high),
    temp_threshold_low: toFiniteNumber(value.temp_threshold_low, defaults.temp_threshold_low),
    soil_threshold_low: Math.min(low, high - 1),
    soil_threshold_high: Math.max(high, low + 1),
    soil_threshold_critical: Math.min(critical, low),
    ph_min: toFiniteNumber(value.ph_min, DEFAULT_SETTINGS.ph_min),
    ph_max: toFiniteNumber(value.ph_max, DEFAULT_SETTINGS.ph_max),
    auto_report: Boolean(value.auto_report),
    report_time: typeof value.report_time === 'string' && /^\d{2}:\d{2}$/.test(value.report_time) ? value.report_time : DEFAULT_SETTINGS.report_time,
    watering_time: typeof value.watering_time === 'string' && /^\d{2}:\d{2}$/.test(value.watering_time) ? value.watering_time : DEFAULT_SETTINGS.watering_time,
    watering_duration: toFiniteNumber(value.watering_duration, DEFAULT_SETTINGS.watering_duration),
    watering_enabled: Boolean(value.watering_enabled),
    user_name: String(value.user_name || DEFAULT_SETTINGS.user_name).trim() || DEFAULT_SETTINGS.user_name,
    user_email: String(value.user_email || DEFAULT_SETTINGS.user_email).trim() || DEFAULT_SETTINGS.user_email,
    soil_moisture_threshold: low,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', { headers: buildApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(normalizeSettings(data));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    setLoading(true);
    try {
      const payload = normalizeSettings(updates);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: buildApiHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to update settings');
      const data = await res.json();
      const normalized = normalizeSettings(data);
      setSettings(normalized);
      setError(null);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    updateSettings,
  };
}
