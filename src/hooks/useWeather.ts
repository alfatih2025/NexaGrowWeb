import { useState, useEffect } from 'react';
import { transformBmkgWeather } from '../lib/bmkgWeather';

export interface WeatherData {
  location: string;
  current: {
    temperature: number;
    humidity: number;
    weather: string;
    wind_speed: number;
    rain_chance: number;
  };
  forecast: Array<{
    datetime: string;
    temperature: number;
    humidity: number;
    weather: string;
    rain_chance: number;
  }>;
}

const BMKG_URL = import.meta.env.VITE_BMKG_URL;

export function useWeather() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const weather = await fetch('/api/weather')
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch weather'))))
          .catch(async () => {
            if (!BMKG_URL) throw new Error('VITE_BMKG_URL is not configured');
            const bmkgRes = await fetch(BMKG_URL);
            if (!bmkgRes.ok) throw new Error('Failed to fetch BMKG weather');
            return transformBmkgWeather(await bmkgRes.json());
          });
        setData(weather);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 300000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}
