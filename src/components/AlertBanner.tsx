import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Thermometer, Droplets} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';

interface AlertBannerProps {
  sensorData: SensorData | null;
  settings: Settings | null;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'warning' | 'danger';
  icon: LucideIcon;
}

export function AlertBanner({ sensorData, settings }: AlertBannerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sensorData || !settings) return;

    const newAlerts: Alert[] = [];

    if (sensorData.temperature > settings.temp_threshold_high) {
      newAlerts.push({
        id: 'temp-high',
        type: 'temperature',
        message: `Suhu terlalu tinggi (${sensorData.temperature}°C). Pastikan irigasi cukup.`,
        severity: 'danger',
        icon: Thermometer
      });
    }

    if (sensorData.temperature < settings.temp_threshold_low) {
      newAlerts.push({
        id: 'temp-low',
        type: 'temperature',
        message: `Suhu terlalu rendah (${sensorData.temperature}°C). Pantau kondisi tanaman.`,
        severity: 'warning',
        icon: Thermometer
      });
    }

    if (sensorData.soil_moisture < settings.soil_moisture_threshold) {
      newAlerts.push({
        id: 'soil-low',
        type: 'soil',
        message: `Kelembapan tanah rendah (${sensorData.soil_moisture}%). Perlu penyiraman.`,
        severity: 'danger',
        icon: Droplets
      });
    }



    setAlerts(newAlerts.filter(a => !dismissed.has(a.id)));
  }, [sensorData, settings, dismissed]);

  const dismissAlert = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <AnimatePresence>
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className={`mb-4 p-4 rounded-xl border-l-4 ${
            alert.severity === 'danger' 
              ? 'bg-red-50 border-red-500' 
              : 'bg-amber-50 border-amber-500'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              alert.severity === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <alert.icon size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className={alert.severity === 'danger' ? 'text-red-500' : 'text-amber-500'} />
                <span className={`text-sm font-semibold ${
                  alert.severity === 'danger' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {alert.severity === 'danger' ? 'PERINGATAN KRITIS' : 'PERHATIAN'}
                </span>
              </div>
              <p className={`text-sm ${alert.severity === 'danger' ? 'text-red-600' : 'text-amber-600'}`}>
                {alert.message}
              </p>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
