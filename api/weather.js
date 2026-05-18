import supabase from './_supabase.js';

const BMKG_URL = process.env.VITE_BMKG_URL || 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74.05.1001';

const DEFAULT_WEATHER = {
  location: 'Lokasi BMKG',
  current: {
    temperature: 28,
    humidity: 75,
    weather: 'Cerah Berawan',
    wind_speed: 10,
    rain_chance: 20,
  },
  forecast: [],
  fetched_at: null,
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function weatherCodeToRainChance(code) {
  const mapping = {
    0: 0,
    1: 10,
    2: 25,
    3: 40,
    4: 55,
    5: 70,
    10: 80,
    45: 60,
    60: 85,
    61: 90,
    63: 95,
    80: 75,
    95: 90,
    97: 95,
  };

  const numeric = Number(code);
  if (Number.isFinite(numeric) && mapping[numeric] !== undefined) return mapping[numeric];
  return 50;
}

function formatLocation(location) {
  const parts = [location?.desa || location?.kelurahan, location?.kecamatan, location?.kotkab, location?.provinsi].filter(Boolean);
  return parts.length ? parts.join(', ') : DEFAULT_WEATHER.location;
}

function extractForecasts(bmkgData) {
  return bmkgData?.data?.[0]?.cuaca?.flat?.() || [];
}

function transformBmkgWeather(bmkgData) {
  const forecasts = extractForecasts(bmkgData);
  const [currentForecast, ...nextForecasts] = forecasts;

  if (!currentForecast) {
    return {
      ...DEFAULT_WEATHER,
      location: formatLocation(bmkgData?.lokasi),
      fetched_at: new Date().toISOString(),
    };
  }

  return {
    location: formatLocation(bmkgData?.lokasi),
    current: {
      temperature: toNumber(currentForecast.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(currentForecast.hu, DEFAULT_WEATHER.current.humidity),
      weather: currentForecast.weather_desc || DEFAULT_WEATHER.current.weather,
      wind_speed: toNumber(currentForecast.ws, DEFAULT_WEATHER.current.wind_speed),
      rain_chance: weatherCodeToRainChance(currentForecast.weather),
    },
    forecast: nextForecasts.slice(0, 8).map((item) => ({
      datetime: item.local_datetime || new Date().toISOString(),
      temperature: toNumber(item.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(item.hu, DEFAULT_WEATHER.current.humidity),
      weather: item.weather_desc || DEFAULT_WEATHER.current.weather,
      rain_chance: weatherCodeToRainChance(item.weather),
    })),
    fetched_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const response = await fetch(BMKG_URL);
    if (!response.ok) throw new Error(`Failed to fetch BMKG weather (${response.status})`);

    const bmkgData = await response.json();
    const weatherData = transformBmkgWeather(bmkgData);

    await supabase.from('activity_logs').insert({
      type: 'weather',
      message: `Weather data fetched for ${weatherData.location}`,
      details: weatherData.current,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return res.status(200).json(weatherData);
  } catch (err) {
    console.error('Weather API error:', err);
    return res.status(200).json({ ...DEFAULT_WEATHER, fetched_at: new Date().toISOString() });
  }
}
