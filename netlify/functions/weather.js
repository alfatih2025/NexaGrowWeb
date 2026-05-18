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
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRainChance(weatherCode) {
  return String(weatherCode ?? '') === '0' ? 0 : 60;
}

function formatLocation(location) {
  const parts = [
    location?.desa || location?.kelurahan,
    location?.kecamatan,
    location?.kotkab,
    location?.provinsi,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : DEFAULT_WEATHER.location;
}

function transformBmkgWeather(data) {
  const forecasts = data?.data?.[0]?.cuaca?.flat() || [];
  const [currentForecast, ...nextForecasts] = forecasts;
  if (!currentForecast) {
    return { ...DEFAULT_WEATHER, location: formatLocation(data?.lokasi) };
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

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const response = await fetch(BMKG_URL);
    if (!response.ok) throw new Error('Failed to fetch BMKG weather');
    const bmkgData = await response.json();
    const weatherData = transformBmkgWeather(bmkgData);

    if (supabase) {
      await supabase.from('activity_logs').insert({
        type: 'weather',
        message: `Weather data fetched for ${weatherData.location}`,
        details: weatherData.current,
      }).catch(() => {});
    }

    return json(200, weatherData);
  } catch (error) {
    return json(200, DEFAULT_WEATHER);
  }
}
