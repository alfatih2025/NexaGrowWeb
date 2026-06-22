import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Power, Timer, Droplets, Settings2, Lightbulb} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useControl } from '../hooks/useControl';
import { SensorData } from '../hooks/useSensorData';

interface ControlPanelProps {
  sensorData: SensorData | null;
}

export function ControlPanel({ sensorData }: ControlPanelProps) {
  const { sendCommand, loading } = useControl();
  const [activeMode, setActiveMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    if (sensorData?.device_mode === 'auto' || sensorData?.device_mode === 'manual') {
      setActiveMode(sensorData.device_mode);
    }
  }, [sensorData?.device_mode]);

  const handleCommand = async (action: string, duration?: number) => {
    try {
      await sendCommand(action, duration);
      if (action === 'mode_auto') setActiveMode('auto');
      if (action === 'mode_manual') setActiveMode('manual');
    } catch (err) {
      console.error('Command failed:', err);
    }
  };

  const ControlButton = ({
    onClick,
    icon: Icon,
    label,
    variant = 'primary',
    disabled = false
  }: {
    onClick: () => void;
    icon: LucideIcon;
    label: string;
    variant?: 'primary' | 'danger' | 'warning' | 'success';
    disabled?: boolean;
  }) => {
    const variants = {
      primary: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200',
      danger: 'bg-red-500 hover:bg-red-600 shadow-red-200',
      warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200',
      success: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200',
    };

    return (
      <motion.button
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        onClick={onClick}
        disabled={disabled || loading}
        className={`${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          w-full flex items-center gap-3 px-5 py-4 rounded-xl text-white font-medium
          shadow-lg transition-all`}
      >
        <Icon size={22} />
        <span>{label}</span>
        {loading && <motion.div className="ml-auto w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
      </motion.button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Mode Operasi</h3>
          <div className="flex bg-gray-100 rounded-xl p-1">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCommand('mode_manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeMode === 'manual'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Manual
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCommand('mode_auto')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeMode === 'auto'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Otomatis
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-xl border-2 transition-all ${
            sensorData?.pump_status
              ? 'bg-blue-50 border-blue-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${sensorData?.pump_status ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <Droplets size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pompa Air</p>
                <p className={`text-lg font-bold ${sensorData?.pump_status ? 'text-blue-600' : 'text-gray-400'}`}>
                  {sensorData?.pump_status ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border-2 transition-all ${
            sensorData?.led_status
              ? 'bg-amber-50 border-amber-200'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${sensorData?.led_status ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <Lightbulb size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Lampu</p>
                <p className={`text-lg font-bold ${sensorData?.led_status ? 'text-amber-600' : 'text-gray-400'}`}>
                  {sensorData?.led_status ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ControlButton
            onClick={() => handleCommand('pump_on')}
            icon={Droplets}
            label="Nyalakan Pompa"
            variant="primary"
            disabled={sensorData?.pump_status === true}
          />
          <ControlButton
            onClick={() => handleCommand('pump_off')}
            icon={Power}
            label="Matikan Pompa"
            variant="danger"
            disabled={sensorData?.pump_status === false}
          />
          <ControlButton
            onClick={() => handleCommand('led_on')}
            icon={Lightbulb}
            label="Nyalakan Lampu"
            variant="warning"
            disabled={sensorData?.led_status === true}
          />
          <ControlButton
            onClick={() => handleCommand('led_off')}
            icon={Settings2}
            label="Matikan Lampu"
            variant="success"
            disabled={sensorData?.led_status === false}
          />
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Tips:</strong> Lampu dari web dikirim ke ESP32 lalu diteruskan ke Arduino Nano. Pastikan ESP32 subscribe ke topic{' '}
            <code className="bg-blue-100 px-2 py-1 rounded text-xs">sproutai/lampu/cmd</code>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <Timer className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-800">Pompa Otomatis 10 Detik</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <ControlButton
            onClick={() => handleCommand('pump_10s', 10)}
            icon={Timer}
            label="Jalankan Pompa 10 Detik"
            variant="primary"
            disabled={sensorData?.pump_status === true}
          />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Mode otomatis akan aktif di ESP32. Saat kelembapan tanah rendah, ESP32 akan menyalakan pompa secara mandiri.
        </p>
      </div>
    </div>
  );
}
