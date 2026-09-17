import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WEATHER_LOCATION_CODE,
  WEATHER_LOCATION_OPTIONS,
  isValidWeatherLocationCode,
  normalizeWeatherLocationCode,
  getWeatherLocationByCode,
  formatWeatherLocationPath,
  resolveWeatherLocationLabel,
  resolveWeatherLocationPath,
  resolveWeatherLocationDisplayName,
  getWeatherLocationsByCategory,
  getWeatherLocationProvinces,
  getWeatherLocationCities,
  getWeatherLocationDistricts,
  getWeatherLocationVillages,
  getWeatherLocationItemByPath,
  buildBmkgWeatherUrl,
} from './weatherLocations';

describe('isValidWeatherLocationCode', () => {
  it('accepts valid ADM4 style codes', () => {
    expect(isValidWeatherLocationCode('33.74')).toBe(true);
    expect(isValidWeatherLocationCode('33.74.07')).toBe(true);
    expect(isValidWeatherLocationCode('33.74.07.1010')).toBe(true);
    expect(isValidWeatherLocationCode('  33.74.07  ')).toBe(true);
  });

  it('rejects malformed codes', () => {
    expect(isValidWeatherLocationCode('33')).toBe(false);
    expect(isValidWeatherLocationCode('abc')).toBe(false);
    expect(isValidWeatherLocationCode('')).toBe(false);
    expect(isValidWeatherLocationCode('33.74.07.10101')).toBe(false);
  });
});

describe('normalizeWeatherLocationCode', () => {
  it('returns the normalized valid code', () => {
    expect(normalizeWeatherLocationCode(' 33.74.07 ')).toBe('33.74.07');
  });

  it('falls back to the default code when invalid', () => {
    expect(normalizeWeatherLocationCode('nope')).toBe(DEFAULT_WEATHER_LOCATION_CODE);
    expect(normalizeWeatherLocationCode(null)).toBe(DEFAULT_WEATHER_LOCATION_CODE);
  });
});

describe('getWeatherLocationByCode', () => {
  it('finds a location present in the options list', () => {
    const first = WEATHER_LOCATION_OPTIONS[0];
    expect(getWeatherLocationByCode(first.code)).toEqual(first);
  });

  it('synthesizes a Semarang village location for a code absent from the options list', () => {
    const item = getWeatherLocationByCode('33.74.07.9999');
    expect(item).toMatchObject({
      code: '33.74.07.9999',
      city: 'Kota Semarang',
      district: 'Semarang Selatan',
      level: 'village',
      village: '9999',
      parentCode: '33.74.07',
    });
  });

  it('synthesizes a Semarang district location from its code', () => {
    const item = getWeatherLocationByCode('33.74.07');
    expect(item).toMatchObject({
      code: '33.74.07',
      district: 'Semarang Selatan',
      level: 'district',
    });
  });

  it('synthesizes the Semarang city location', () => {
    const item = getWeatherLocationByCode('33.74');
    expect(item).toMatchObject({ code: '33.74', level: 'city', city: 'Kota Semarang' });
  });

  it('returns null for an unknown district code', () => {
    expect(getWeatherLocationByCode('33.74.99')).toBeNull();
  });

  it('returns null for an unresolvable code', () => {
    expect(getWeatherLocationByCode('99.99.99')).toBeNull();
  });
});

describe('formatWeatherLocationPath', () => {
  it('returns an empty string for nullish input', () => {
    expect(formatWeatherLocationPath(null)).toBe('');
    expect(formatWeatherLocationPath(undefined)).toBe('');
  });

  it('joins unique trail parts with a bullet separator', () => {
    const path = formatWeatherLocationPath({
      code: '33.74.07.1010',
      label: '1010',
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      district: 'Semarang Selatan',
      village: '1010',
      category: 'semarang',
      level: 'village',
    });
    expect(path).toBe('1010 • Semarang Selatan • Kota Semarang • Jawa Tengah');
  });
});

describe('resolve helpers', () => {
  it('resolveWeatherLocationLabel includes the readable path and code in parentheses', () => {
    expect(resolveWeatherLocationLabel('33.74')).toBe('Kota Semarang • Jawa Tengah (33.74)');
  });

  it('resolveWeatherLocationLabel handles unknown codes', () => {
    expect(resolveWeatherLocationLabel('99.99.99')).toBe('Lokasi BMKG 99.99.99');
  });

  it('resolveWeatherLocationPath returns the readable path', () => {
    expect(resolveWeatherLocationPath('33.74')).toBe('Kota Semarang • Jawa Tengah');
  });

  it('resolveWeatherLocationPath falls back to the code for unknown codes', () => {
    expect(resolveWeatherLocationPath('99.99.99')).toBe('99.99.99');
    expect(resolveWeatherLocationPath('')).toBe(DEFAULT_WEATHER_LOCATION_CODE);
  });

  it('resolveWeatherLocationDisplayName mirrors resolveWeatherLocationPath', () => {
    expect(resolveWeatherLocationDisplayName('33.74')).toBe(resolveWeatherLocationPath('33.74'));
  });
});

describe('category-based lookups', () => {
  it('filters options by category', () => {
    const semarang = getWeatherLocationsByCategory('semarang');
    expect(semarang.length).toBeGreaterThan(0);
    expect(semarang.every((item) => item.category === 'semarang')).toBe(true);
  });

  it('lists unique provinces for a category', () => {
    const provinces = getWeatherLocationProvinces('semarang');
    expect(provinces).toContain('Jawa Tengah');
    expect(new Set(provinces).size).toBe(provinces.length);
  });

  it('lists cities within a province', () => {
    const cities = getWeatherLocationCities('semarang', 'Jawa Tengah');
    expect(cities).toContain('Kota Semarang');
  });

  it('lists districts within a city', () => {
    const districts = getWeatherLocationDistricts('semarang', 'Jawa Tengah', 'Kota Semarang');
    expect(districts).toContain('Semarang Tengah');
  });

  it('lists only village-level entries for a district', () => {
    const villages = getWeatherLocationVillages('semarang', 'Jawa Tengah', 'Kota Semarang', 'Semarang Tengah');
    expect(villages.every((item) => item.level === 'village')).toBe(true);
  });
});

describe('getWeatherLocationItemByPath', () => {
  it('prefers the city-level entry when no district is given', () => {
    const item = getWeatherLocationItemByPath('semarang', 'Jawa Tengah', 'Kota Semarang');
    expect(item?.level).toBe('city');
  });

  it('returns a district entry when the district is specified', () => {
    const item = getWeatherLocationItemByPath('semarang', 'Jawa Tengah', 'Kota Semarang', 'Semarang Tengah');
    expect(item?.district || item?.label).toBe('Semarang Tengah');
  });

  it('returns null when nothing matches', () => {
    expect(getWeatherLocationItemByPath('semarang', 'Nowhere', 'Nope')).toBeNull();
  });
});

describe('buildBmkgWeatherUrl', () => {
  it('returns the local API fallback when base url is empty', () => {
    expect(buildBmkgWeatherUrl('', '33.74.07')).toBe('/api/weather?location=33.74.07');
  });

  it('normalizes an invalid code in the fallback path', () => {
    expect(buildBmkgWeatherUrl('', 'bad')).toBe(
      `/api/weather?location=${encodeURIComponent(DEFAULT_WEATHER_LOCATION_CODE)}`,
    );
  });

  it('adds the adm4 query parameter to an absolute base url', () => {
    const url = buildBmkgWeatherUrl('https://api.bmkg.go.id/publik/prakiraan-cuaca', '33.74.07');
    expect(url).toContain('adm4=33.74.07');
    expect(url.startsWith('https://api.bmkg.go.id/')).toBe(true);
  });

  it('adds the adm4 parameter to a relative base url', () => {
    const url = buildBmkgWeatherUrl('/proxy/weather', '33.74.07');
    expect(url).toContain('adm4=33.74.07');
    expect(url).toContain('/proxy/weather');
  });
});
