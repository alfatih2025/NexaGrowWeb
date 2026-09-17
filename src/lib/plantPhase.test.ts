import { describe, it, expect } from 'vitest';
import {
  PLANT_PHASE_PROFILES,
  normalizePlantPhase,
  getPlantPhaseProfile,
  getPhaseDefaults,
  getPlantHealthSummary,
  formatRange,
} from './plantPhase';

describe('normalizePlantPhase', () => {
  it('returns generatif only for the exact (case/space-insensitive) match', () => {
    expect(normalizePlantPhase('generatif')).toBe('generatif');
    expect(normalizePlantPhase('  GENERATIF  ')).toBe('generatif');
    expect(normalizePlantPhase('Generatif')).toBe('generatif');
  });

  it('defaults to vegetatif for anything else', () => {
    expect(normalizePlantPhase('vegetatif')).toBe('vegetatif');
    expect(normalizePlantPhase('unknown')).toBe('vegetatif');
    expect(normalizePlantPhase('')).toBe('vegetatif');
    expect(normalizePlantPhase(null)).toBe('vegetatif');
    expect(normalizePlantPhase(undefined)).toBe('vegetatif');
    expect(normalizePlantPhase(123)).toBe('vegetatif');
  });
});

describe('getPlantPhaseProfile', () => {
  it('returns the matching profile', () => {
    expect(getPlantPhaseProfile('generatif')).toBe(PLANT_PHASE_PROFILES.generatif);
    expect(getPlantPhaseProfile('vegetatif')).toBe(PLANT_PHASE_PROFILES.vegetatif);
    expect(getPlantPhaseProfile('garbage')).toBe(PLANT_PHASE_PROFILES.vegetatif);
  });
});

describe('getPhaseDefaults', () => {
  it('maps profile ranges to threshold fields', () => {
    const defaults = getPhaseDefaults('generatif');
    const profile = PLANT_PHASE_PROFILES.generatif;
    expect(defaults).toEqual({
      plant_phase: 'generatif',
      temp_threshold_low: profile.tempRange[0],
      temp_threshold_high: profile.tempRange[1],
      humidity_threshold_low: profile.humidityRange[0],
      humidity_threshold_high: profile.humidityRange[1],
      soil_threshold_low: profile.soilRange[0],
      soil_threshold_high: profile.soilRange[1],
      soil_threshold_critical: profile.criticalSoil,
      humidityRange: profile.humidityRange,
    });
  });
});

describe('getPlantHealthSummary', () => {
  it('returns unknown state when soil moisture is missing', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif' });
    expect(summary.healthState).toBe('unknown');
    // no soil/temp/weather alerts -> falls back to a single phase info alert
    expect(summary.alerts).toHaveLength(1);
    expect(summary.alerts[0].type).toBe('phase');
    expect(summary.alerts[0].severity).toBe('info');
  });

  it('flags critical soil below the critical threshold with an email alert', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 10 });
    expect(summary.healthState).toBe('kritis');
    expect(summary.statusTone).toBe('danger');
    const soilAlert = summary.alerts.find((a) => a.type === 'soil');
    expect(soilAlert?.severity).toBe('danger');
    expect(soilAlert?.sendEmail).toBe(true);
  });

  it('flags waspada when soil is between critical and low thresholds', () => {
    // vegetatif: critical 35, low 45
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 40 });
    expect(summary.healthState).toBe('waspada');
    expect(summary.statusTone).toBe('warning');
    const soilAlert = summary.alerts.find((a) => a.type === 'soil');
    expect(soilAlert?.severity).toBe('warning');
    expect(soilAlert?.sendEmail).toBeUndefined();
  });

  it('flags waspada when soil is well above the high threshold', () => {
    // vegetatif: high 75, trigger requires > high + 8
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 90 });
    expect(summary.healthState).toBe('waspada');
    expect(summary.statusLabel).toBe('Media Terlalu Basah');
  });

  it('reports sehat when soil is within range', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 60 });
    expect(summary.healthState).toBe('sehat');
    expect(summary.statusTone).toBe('good');
  });

  it('adds a warning temperature alert when slightly out of range', () => {
    // vegetatif temp range 22-34; 36 is out but within 4 degrees
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 60, temperature: 36 });
    const tempAlert = summary.alerts.find((a) => a.type === 'temperature');
    expect(tempAlert?.severity).toBe('warning');
    expect(tempAlert?.sendEmail).toBe(false);
  });

  it('escalates temperature alert to danger and email when extreme', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 60, temperature: 45 });
    const tempAlert = summary.alerts.find((a) => a.type === 'temperature');
    expect(tempAlert?.severity).toBe('danger');
    expect(tempAlert?.sendEmail).toBe(true);
  });

  it('does not downgrade a critical soil state when temperature is extreme', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 10, temperature: 45 });
    expect(summary.healthState).toBe('kritis');
  });

  it('adds a weather alert when rain chance is high', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 60, rainChance: 80 });
    const weatherAlert = summary.alerts.find((a) => a.type === 'weather');
    expect(weatherAlert).toBeDefined();
    expect(weatherAlert?.severity).toBe('warning');
  });

  it('adds a weather alert when the label looks wet', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: 60, weatherLabel: 'Hujan Ringan' });
    expect(summary.alerts.some((a) => a.type === 'weather')).toBe(true);
  });

  it('respects custom thresholds passed in the input', () => {
    const summary = getPlantHealthSummary({
      phase: 'vegetatif',
      soilMoisture: 50,
      soilCritical: 55,
    });
    expect(summary.healthState).toBe('kritis');
    expect(summary.recommendedSoilRange[0]).toBe(45);
  });

  it('parses numeric strings with comma decimals', () => {
    const summary = getPlantHealthSummary({ phase: 'vegetatif', soilMoisture: '60,5' });
    expect(summary.healthState).toBe('sehat');
  });
});

describe('formatRange', () => {
  it('formats with default percent suffix', () => {
    expect(formatRange([45, 75])).toBe('45%–75%');
  });

  it('formats with a custom suffix', () => {
    expect(formatRange([22, 34], '°C')).toBe('22°C–34°C');
  });
});
