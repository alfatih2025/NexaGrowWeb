import type { WeatherData } from '../hooks/useWeather';

type BmkgForecast = {
  local_datetime?: string;
  t?: number | string;
  hu?: number | string;
  weather?: number | string;
  weather_desc?: string;
  ws?: number | string;
};

type BmkgLocation = {
  desa?: string;
  kelurahan?: string;
  kecamatan?: string;
  kotkab?: string;
  provinsi?: string;
};

type BmkgResponse = {
  lokasi?: BmkgLocation;
  data?: Array<{
    cuaca?: BmkgForecast[][];
  }>;
};

const DEFAULT_WEATHER: WeatherData = {
  location: 'Lokasi BMKG',
  current: {
    temperature: 28,
    humidity: 75,
    weather: 'Cerah Berawan',
    wind_speed: 10,
    rain_chance: 20,
  },
  forecast: [],
};

function toNumber(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRainChance(weatherCode: number | string | undefined) {
  return String(weatherCode ?? '') === '0' ? 0 : 60;
}

function formatLocation(location?: BmkgLocation) {
  const parts = [
    location?.desa || location?.kelurahan,
    location?.kecamatan,
    location?.kotkab,
    location?.provinsi,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : DEFAULT_WEATHER.location;
}

export function transformBmkgWeather(data: BmkgResponse): WeatherData {
  const forecasts = data.data?.[0]?.cuaca?.flat() ?? [];
  const [currentForecast, ...nextForecasts] = forecasts;

  if (!currentForecast) {
    return {
      ...DEFAULT_WEATHER,
      location: formatLocation(data.lokasi),
    };
  }

  return {
    location: formatLocation(data.lokasi),
    current: {
      temperature: toNumber(currentForecast.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(currentForecast.hu, DEFAULT_WEATHER.current.humidity),
      weather: currentForecast.weather_desc || DEFAULT_WEATHER.current.weather,
      wind_speed: toNumber(currentForecast.ws, DEFAULT_WEATHER.current.wind_speed),
      rain_chance: getRainChance(currentForecast.weather),
    },
    forecast: nextForecasts.slice(0, 8).map((item) => ({
      datetime: item.local_datetime || new Date().toISOString(),
      temperature: toNumber(item.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(item.hu, DEFAULT_WEATHER.current.humidity),
      weather: item.weather_desc || DEFAULT_WEATHER.current.weather,
      rain_chance: getRainChance(item.weather),
    })),
  };
}

export { DEFAULT_WEATHER };
