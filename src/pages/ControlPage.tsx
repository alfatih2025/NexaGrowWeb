import { ControlPanel } from '../components/ControlPanel';
import { Zap, History, Lightbulb } from 'lucide-react';
import { useControl } from '../hooks/useControl';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SensorData } from '../hooks/useSensorData';

interface ControlPageProps {
  sensorData: SensorData | null;
}

export function ControlPage({ sensorData }: ControlPageProps) {
  const { logs, fetchLogs, sendCommand } = useControl();
  const [ledStatus, setLedStatus] = useState<'ON' | 'OFF'>('OFF');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setLedStatus(sensorData?.led_status ? 'ON' : 'OFF');
  }, [sensorData?.led_status]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleLedToggle = async (command: 'ON' | 'OFF') => {
    setIsLoading(true);
    try {
      await sendCommand(command === 'ON' ? 'led_on' : 'led_off');
      setLedStatus(command);
      console.log(`Lampu ${command}`);
    } catch (err) {
      console.error('Failed to control LED:', err);
      alert('Gagal mengontrol lampu');
    } finally {
      setIsLoading(false);
    }
  };

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">Kontrol Perangkat</h2>
      </div>

      <ControlPanel sensorData={sensorData} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                ledStatus === 'ON'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <Lightbulb size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Kontrol Lampu LED</h3>
              <p
                className={`text-sm font-medium ${
                  ledStatus === 'ON' ? 'text-yellow-600' : 'text-gray-500'
                }`}
              >
                Status: {ledStatus === 'ON' ? '💡 MENYALA' : '⚫ MATI'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleLedToggle('ON')}
            disabled={isLoading || ledStatus === 'ON'}
            className={`px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              ledStatus === 'ON'
                ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200'
                : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Lightbulb size={20} />
            <span>Nyalakan Lampu</span>
            {isLoading && (
              <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleLedToggle('OFF')}
            disabled={isLoading || ledStatus === 'OFF'}
            className={`px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              ledStatus === 'OFF'
                ? 'bg-gray-400 text-white shadow-lg shadow-gray-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Lightbulb size={20} />
            <span>Matikan Lampu</span>
            {isLoading && (
              <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </motion.button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Tips:</strong> Lampu dikontrol melalui MQTT. Pastikan ESP32 subscribe ke topic{' '}
            <code className="bg-blue-100 px-2 py-1 rounded text-xs">sproutai/lampu/cmd</code>
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-800">Riwayat Perintah</h3>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {recentLogs.map((log, idx) => (
            <div
              key={log.id}
              className={`flex items-center justify-between p-3 rounded-xl ${
                log.status === 'completed'
                  ? 'bg-emerald-50'
                  : log.status === 'failed'
                    ? 'bg-red-50'
                    : 'bg-amber-50'
              }`}
            >
              <div>
                <p className="font-medium text-gray-800">{log.action}</p>
                <p className="text-sm text-gray-500">
                  {new Date(log.executed_at).toLocaleString('id-ID')}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  log.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : log.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {log.status}
              </span>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <div className="text-sm text-gray-500">Belum ada riwayat perintah.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
