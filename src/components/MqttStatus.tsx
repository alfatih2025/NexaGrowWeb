import { motion } from 'framer-motion';
import { Wifi, AlertCircle, Activity } from 'lucide-react';
import { useMqttStatus } from '../hooks/useMqttStatus';

export function MqttStatus() {
  const status = useMqttStatus();
  const sensor = status.sensorSnapshot;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wifi size={18} className="text-emerald-600" />
          <h4 className="font-semibold text-gray-800 text-sm">Status Koneksi</h4>
        </div>
        <div className="flex gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            status.systemOnline
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            Sistem: {status.systemOnline ? '🟢 Online' : '🔴 Offline'}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            status.mqttConnected
              ? 'bg-blue-100 text-blue-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            MQTT: {status.mqttConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Broker</p>
          <p className="font-mono text-xs truncate text-gray-700">{status.brokerUrl.split('//')[1]?.split(':')[0] || 'N/A'}</p>
        </div>

        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">ESP32 Status</p>
          <p className={`font-semibold ${status.espOnline ? 'text-emerald-600' : 'text-red-600'}`}>
            {status.espOnline ? '🟢 Online' : '🔴 Offline'}
          </p>
        </div>

        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Status Web</p>
          <p className={`font-semibold ${status.browserOnline ? 'text-emerald-600' : 'text-red-600'}`}>
            {status.browserOnline ? '🟢 Online' : '🔴 Offline'}
          </p>
        </div>

        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Mode</p>
          <p className="font-semibold text-gray-700">
            {sensor?.device_mode === 'auto' ? 'Otomatis' : sensor?.device_mode === 'manual' ? 'Manual' : 'N/A'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Last Message</p>
          <p className="font-mono text-gray-700">
            {status.lastMessageAt ? new Date(status.lastMessageAt).toLocaleTimeString('id-ID') : 'N/A'}
          </p>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Suhu</p>
          <p className="font-semibold text-gray-700">
            {sensor?.temperature ?? 'N/A'}{sensor?.temperature != null ? '°C' : ''}
          </p>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Soil</p>
          <p className="font-semibold text-gray-700">
            {sensor?.soil_moisture ?? 'N/A'}{sensor?.soil_moisture != null ? '%' : ''}
          </p>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <p className="text-gray-500">Lampu / Pompa</p>
          <p className="font-semibold text-gray-700">
            {sensor ? `${sensor.led_status ? 'Lampu ON' : 'Lampu OFF'} / ${sensor.pump_status ? 'Pompa ON' : 'Pompa OFF'}` : 'N/A'}
          </p>
        </div>
      </div>

      {status.mqttError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 p-2 bg-red-50 border border-red-200 rounded flex items-start gap-2"
        >
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-700">Error:</p>
            <p className="text-xs text-red-600">{status.mqttError}</p>
          </div>
        </motion.div>
      )}

      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs flex items-start gap-2">
        <Activity size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-700 font-medium">Ringkasan sistem</p>
          <p className="text-blue-600">{status.systemDetail}</p>
        </div>
      </div>
    </motion.div>
  );
}
