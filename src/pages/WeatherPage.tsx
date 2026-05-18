import { useWeather } from '../hooks/useWeather';
import { WeatherCard } from '../components/WeatherCard';
import { CloudSun } from 'lucide-react';
import { motion } from 'framer-motion';

export function WeatherPage() {
  const { data, loading } = useWeather();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <CloudSun className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">Prakiraan Cuaca</h2>
      </div>

      <div className="max-w-2xl">
        <WeatherCard data={data} loading={loading} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Cuaca</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-emerald-50 rounded-xl">
            <h4 className="font-semibold text-emerald-800 mb-2">🌱 Dampak ke Pertanian</h4>
            <p className="text-emerald-600">Data cuaca BMKG membantu menentukan jadwal penyiraman optimal dan memprediksi risiko hama.</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <h4 className="font-semibold text-blue-800 mb-2">💡 Tips Berdasarkan Cuaca</h4>
            <p className="text-blue-600">AI Assistant akan memberikan rekomendasi perawatan berdasarkan kondisi cuaca terkini.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
