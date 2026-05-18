import { motion } from 'framer-motion';
import { CloudRain, Sun, Cloud, Wind, Droplets, Thermometer, Umbrella } from 'lucide-react';
import { WeatherData } from '../hooks/useWeather';

interface WeatherCardProps {
  data: WeatherData | null;
  loading: boolean;
}

const weatherIcons: Record<string, typeof Sun> = {
  'Cerah': Sun,
  'Cerah Berawan': Cloud,
  'Berawan': Cloud,
  'Hujan': CloudRain,
  'Hujan Ringan': CloudRain,
  'Hujan Lebat': CloudRain,
};

export function WeatherCard({ data, loading }: WeatherCardProps) {
  if (loading || !data) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const WeatherIcon = weatherIcons[data.current.weather] || Sun;

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{data.location}</h3>
          <p className="text-blue-100 text-sm">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          <WeatherIcon size={32} className="text-white" />
        </div>
      </div>

      <div className="flex items-end gap-2 mb-6">
        <span className="text-5xl font-bold">{data.current.temperature}</span>
        <span className="text-2xl text-blue-200 mb-1">°C</span>
      </div>

      <p className="text-lg font-medium mb-4">{data.current.weather}</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Droplets size={18} className="text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">Kelembapan</p>
            <p className="font-semibold">{data.current.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wind size={18} className="text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">Angin</p>
            <p className="font-semibold">{data.current.wind_speed} km/j</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Umbrella size={18} className="text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">Hujan</p>
            <p className="font-semibold">{data.current.rain_chance}%</p>
          </div>
        </div>
      </div>

      {data.forecast.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/20">
          <p className="text-sm font-medium mb-3">Prakiraan Mendatang</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.forecast.slice(0, 5).map((item, idx) => (
              <div key={idx} className="text-center min-w-[60px]">
                <p className="text-xs text-blue-200">{new Date(item.datetime).getHours()}:00</p>
                <div className="my-2">
                  {weatherIcons[item.weather] ? (
                    <span className="text-xl">🌤️</span>
                  ) : (
                    <span className="text-xl">☀️</span>
                  )}
                </div>
                <p className="font-semibold">{item.temperature}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
