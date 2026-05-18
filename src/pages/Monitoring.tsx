import { motion } from 'framer-motion';
import { SensorChart } from '../components/SensorChart';
import { SensorData } from '../hooks/useSensorData';
import { Activity, Table2 } from 'lucide-react';

interface MonitoringProps {
  history: SensorData[];
}

export function Monitoring({ history }: MonitoringProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">Monitoring Real-time</h2>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SensorChart
          data={history}
          type="temperature"
          title="Grafik Suhu (°C)"
          color="#f97316"
        />
        <SensorChart
          data={history}
          type="humidity"
          title="Grafik Kelembapan Udara (%)"
          color="#3b82f6"
        />


        <SensorChart
          data={history}
          type="soil_moisture"
          title="Grafik Kelembapan Tanah (%)"
          color="#10b981"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <Table2 className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-800">Riwayat Data Sensor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Suhu (°C)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kelembapan (%)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Soil (%)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pompa</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lampu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.slice(0, 20).map((item, idx) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-gray-50/50"
                >
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(item.created_at).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.temperature > 35 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.temperature}°C
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.humidity}%</td>
                  <td className="px-6 py-4">

                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.soil_moisture < 40 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.soil_moisture}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.pump_status ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.pump_status ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.led_status ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.led_status ? 'ON' : 'OFF'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
