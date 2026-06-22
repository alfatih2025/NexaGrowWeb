import supabase from './_supabase.js';

const BMKG_URL = process.env.VITE_BMKG_URL || 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74.05.1001';

const DEFAULT_WEATHER = {
  location: 'Lokasi BMKG',
  current: {
    temperature: 28,
    humidity: 75,
    weather: 'Cerah Berawan',
    wind_speed: 10,
    rain_chance: 20
  },
  forecast: []
};

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
    location?.provinsi
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : DEFAULT_WEATHER.location;
}

function transformBmkgWeather(bmkgData) {
  const forecasts = bmkgData?.data?.[0]?.cuaca?.flat() || [];
  const [currentForecast, ...nextForecasts] = forecasts;

  if (!currentForecast) {
    return {
      ...DEFAULT_WEATHER,
      location: formatLocation(bmkgData?.lokasi)
    };
  }

  return {
    location: formatLocation(bmkgData?.lokasi),
    current: {
      temperature: toNumber(currentForecast.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(currentForecast.hu, DEFAULT_WEATHER.current.humidity),
      weather: currentForecast.weather_desc || DEFAULT_WEATHER.current.weather,
      wind_speed: toNumber(currentForecast.ws, DEFAULT_WEATHER.current.wind_speed),
      rain_chance: getRainChance(currentForecast.weather)
    },
    forecast: nextForecasts.slice(0, 8).map((item) => ({
      datetime: item.local_datetime || new Date().toISOString(),
      temperature: toNumber(item.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(item.hu, DEFAULT_WEATHER.current.humidity),
      weather: item.weather_desc || DEFAULT_WEATHER.current.weather,
      rain_chance: getRainChance(item.weather)
    }))
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const response = await fetch(BMKG_URL);
    if (!response.ok) throw new Error('Failed to fetch BMKG weather');
    const bmkgData = await response.json();
    const weatherData = transformBmkgWeather(bmkgData);
    
    await supabase.from('activity_logs').insert({
      type: 'weather',
      message: `Weather data fetched for ${weatherData.location}`,
      details: weatherData.current
    });
    
    return res.status(200).json(weatherData);
  } catch (err) {
    console.error('Weather API error:', err);
    return res.status(200).json(DEFAULT_WEATHER);
  }
}
