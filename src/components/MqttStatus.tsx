import { motion } from 'framer-motion';
import { Wifi, AlertCircle, Activity, CalendarClock, Droplets, Thermometer } from 'lucide-react';
import { useMqttStatus } from '../hooks/useMqttStatus';

function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(1);
}

export function MqttStatus() {
  const status = useMqttStatus();
  const sensor = status.sensorSnapshot;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wifi size={18} className="text-emerald-600" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status Koneksi</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${status.systemOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'}`}>
            {status.systemOnline ? 'Sistem Online' : 'Sistem Offline'}
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${status.mqttConnected ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>
            {status.mqttConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Broker</p>
          <p className="truncate font-mono text-xs text-slate-700 dark:text-slate-200">
            {status.brokerUrl.split('//')[1]?.split(':')[0] || 'N/A'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">ESP32 Status</p>
          <p className={`font-semibold ${status.espOnline ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
            {status.espOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Status Web</p>
          <p className={`font-semibold ${status.browserOnline ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
            {status.browserOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Mode</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {sensor?.device_mode === 'auto' ? 'Otomatis' : sensor?.device_mode === 'manual' ? 'Manual' : 'N/A'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Last Message</p>
          <p className="font-mono text-slate-700 dark:text-slate-200">
            {status.lastMessageAt ? new Date(status.lastMessageAt).toLocaleTimeString('id-ID') : 'N/A'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Suhu</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {formatOneDecimal(sensor?.temperature)}{sensor?.temperature != null ? '°C' : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Soil</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {formatOneDecimal(sensor?.soil_moisture)}{sensor?.soil_moisture != null ? '%' : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Device</p>
          <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{sensor?.device_id ?? 'N/A'}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Jadwal</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {sensor?.schedule_enabled ? 'Aktif' : 'Nonaktif'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Jam Siram</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">{sensor?.watering_time || 'N/A'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Durasi</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {sensor?.watering_duration != null ? `${sensor.watering_duration} detik` : 'N/A'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Update</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {status.lastMessageAt ? new Date(status.lastMessageAt).toLocaleString('id-ID') : 'N/A'}
          </p>
        </div>
      </div>

      {status.mqttError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10"
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-300" />
          <div>
            <p className="text-xs font-medium text-red-700 dark:text-red-200">Error:</p>
            <p className="text-xs text-red-600 dark:text-red-200">{status.mqttError}</p>
          </div>
        </motion.div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-500/20 dark:bg-blue-500/10">
        <Activity size={16} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
        <div>
          <p className="font-medium text-blue-700 dark:text-blue-200">Ringkasan sistem</p>
          <p className="text-blue-600 dark:text-blue-200">{status.systemDetail}</p>
        </div>
      </div>
    </motion.div>
  );
}
