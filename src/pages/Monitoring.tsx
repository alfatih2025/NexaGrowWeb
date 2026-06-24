
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SensorChart } from '../components/SensorChart';
import { SensorData } from '../hooks/useSensorData';
import { Activity, Table2, Wifi, WifiOff } from 'lucide-react';
import type { MqttSensorSnapshot } from '../services/mqtt';

interface MonitoringProps {
  history: SensorData[];
  sensorData: SensorData | null;
  mqttHistory: MqttSensorSnapshot[];
}

function formatOneDecimal(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '-';
}

function toChartRow(item: SensorData | MqttSensorSnapshot) {
  return {
    ...item,
    created_at: (item as SensorData).created_at ?? (item as MqttSensorSnapshot).updatedAt ?? new Date().toISOString(),
    device_id: item.device_id ?? 'ESP32_001',
    temperature: item.temperature ?? 0,
    humidity: item.humidity ?? 0,
    soil_moisture: item.soil_moisture ?? 0,
    pump_status: Boolean(item.pump_status),
    led_status: Boolean(item.led_status),
    schedule_enabled: item.schedule_enabled ?? true,
  } as SensorData;
}

export function Monitoring({ history, sensorData, mqttHistory }: MonitoringProps) {
  const chartHistory = useMemo(() => {
    const merged = [...history.map(toChartRow), ...mqttHistory.map(toChartRow)];
    if (sensorData) merged.unshift(toChartRow(sensorData));
    const seen = new Set<string>();
    return merged
      .filter((item) => {
        const key = `${item.created_at}-${item.temperature}-${item.humidity}-${item.soil_moisture}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-60);
  }, [history, mqttHistory, sensorData]);

  const latest = chartHistory[chartHistory.length - 1] ?? sensorData ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-emerald-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Monitoring Real-time</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SensorChart data={chartHistory} type="temperature" title="Grafik Suhu (°C)" color="#f97316" />
        <SensorChart data={chartHistory} type="humidity" title="Grafik Kelembapan Udara (%)" color="#3b82f6" />
        <SensorChart data={chartHistory} type="soil_moisture" title="Grafik Kelembapan Tanah (%)" color="#10b981" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 p-6 dark:border-slate-800">
          <Table2 className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Riwayat Data Sensor</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {latest ? `Update terakhir ${new Date(latest.created_at).toLocaleString('id-ID')}` : 'Belum ada data sensor'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {latest ? <Wifi size={14} /> : <WifiOff size={14} />}
            {latest ? 'Data tersedia' : 'Menunggu data'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Waktu</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Suhu (°C)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kelembapan (%)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Soil (%)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pompa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {chartHistory.slice(-20).reverse().map((item, idx) => (
                <motion.tr
                  key={`${item.device_id}-${item.created_at}-${idx}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60"
                >
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{new Date(item.created_at).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.temperature > 35
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                    }`}>
                      {formatOneDecimal(item.temperature)}°C
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{formatOneDecimal(item.humidity)}%</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.soil_moisture < 40
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
                    }`}>
                      {formatOneDecimal(item.soil_moisture)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.pump_status
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {item.pump_status ? 'ON' : 'OFF'}
                    </span>
                  </td>
                </motion.tr>
              ))}
              {chartHistory.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                    Belum ada data yang tersimpan. Pastikan ESP32 mengirim JSON sensor ke topic MQTT atau endpoint API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
