import { describe, it, expect } from 'vitest';
import { transformBmkgWeather, createStaticWeatherFallback, DEFAULT_WEATHER } from './bmkgWeather';

describe('transformBmkgWeather', () => {
  it('returns default weather with a fallback location when there are no forecasts', () => {
    const result = transformBmkgWeather({}, 'Fallback City');
    expect(result.location).toBe('Fallback City');
    expect(result.current).toEqual(DEFAULT_WEATHER.current);
    expect(result.forecast).toEqual([]);
  });

  it('formats the location from the BMKG location object', () => {
    const result = transformBmkgWeather({
      lokasi: { desa: 'Desa A', kecamatan: 'Kec B', kotkab: 'Kota C', provinsi: 'Prov D' },
    });
    expect(result.location).toBe('Desa A, Kec B, Kota C, Prov D');
  });

  it('prefers kelurahan when desa is absent and skips empty parts', () => {
    const result = transformBmkgWeather({
      lokasi: { kelurahan: 'Kel X', provinsi: 'Prov Y' },
    });
    expect(result.location).toBe('Kel X, Prov Y');
  });

  it('maps the first forecast to current conditions', () => {
    const result = transformBmkgWeather({
      data: [
        {
          cuaca: [
            [
              { t: 30, hu: 80, ws: 12, weather: 0, weather_desc: 'Cerah' },
              { local_datetime: '2025-01-01T03:00:00', t: 28, hu: 85, weather: 60, weather_desc: 'Hujan' },
            ],
          ],
        },
      ],
    });

    expect(result.current).toEqual({
      temperature: 30,
      humidity: 80,
      weather: 'Cerah',
      wind_speed: 12,
      rain_chance: 0,
    });
    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0]).toEqual({
      datetime: '2025-01-01T03:00:00',
      temperature: 28,
      humidity: 85,
      weather: 'Hujan',
      rain_chance: 60,
    });
  });

  it('falls back to default numeric values for invalid readings', () => {
    const result = transformBmkgWeather({
      data: [{ cuaca: [[{ t: 'not-a-number', hu: undefined, ws: 'x', weather: 2 }]] }],
    });
    expect(result.current.temperature).toBe(DEFAULT_WEATHER.current.temperature);
    expect(result.current.humidity).toBe(DEFAULT_WEATHER.current.humidity);
    expect(result.current.wind_speed).toBe(DEFAULT_WEATHER.current.wind_speed);
    expect(result.current.weather).toBe(DEFAULT_WEATHER.current.weather);
    // weather code 2 -> 10% rain chance
    expect(result.current.rain_chance).toBe(10);
  });

  it('maps weather codes to rain chance buckets', () => {
    const rainFor = (code: number | string) =>
      transformBmkgWeather({ data: [{ cuaca: [[{ weather: code }]] }] }).current.rain_chance;
    expect(rainFor(0)).toBe(0);
    expect(rainFor(3)).toBe(10);
    expect(rainFor(5)).toBe(35);
    expect(rainFor(95)).toBe(60);
  });

  it('caps the forecast list at 8 entries', () => {
    const many = Array.from({ length: 12 }).map((_, i) => ({ t: i, hu: 50, weather: 0 }));
    const result = transformBmkgWeather({ data: [{ cuaca: [[{ t: 1, hu: 1, weather: 0 }, ...many]] }] });
    expect(result.forecast).toHaveLength(8);
  });
});

describe('createStaticWeatherFallback', () => {
  it('is deterministic for the same location code', () => {
    const a = createStaticWeatherFallback('CODE1', 'Label 1');
    const b = createStaticWeatherFallback('CODE1', 'Label 1');
    expect(a.current).toEqual(b.current);
    expect(a.forecast.map((f) => ({ ...f, datetime: null }))).toEqual(
      b.forecast.map((f) => ({ ...f, datetime: null })),
    );
  });

  it('uses the provided label and code', () => {
    const result = createStaticWeatherFallback('33.74.01.1001', 'Semarang');
    expect(result.location).toBe('Semarang');
    expect(result.location_code).toBe('33.74.01.1001');
  });

  it('produces 8 forecast entries with bounded humidity', () => {
    const result = createStaticWeatherFallback('anything', 'Anywhere');
    expect(result.forecast).toHaveLength(8);
    for (const item of result.forecast) {
      expect(item.humidity).toBeGreaterThanOrEqual(45);
      expect(item.humidity).toBeLessThanOrEqual(96);
      expect(typeof item.datetime).toBe('string');
    }
  });

  it('produces valid values even when code and label are empty', () => {
    const result = createStaticWeatherFallback('', '');
    expect(result.current.temperature).toBeGreaterThanOrEqual(24);
    expect(result.current.humidity).toBeGreaterThanOrEqual(62);
  });
});
