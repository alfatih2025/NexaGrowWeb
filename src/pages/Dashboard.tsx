import { motion } from 'framer-motion';
import {
  Thermometer,
  Droplets,
  Sprout,
  Power,
  Clock,
  Server,
  Lightbulb,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SensorCard } from '../components/SensorCard';
import { WeatherCard } from '../components/WeatherCard';
import { AlertBanner } from '../components/AlertBanner';
import { ChatInterface } from '../components/ChatInterface';
import { SensorData } from '../hooks/useSensorData';
import { DeviceStatus } from '../hooks/useDeviceStatus';
import { WeatherData } from '../hooks/useWeather';
import { Settings } from '../hooks/useSettings';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';

interface DashboardProps {
  sensorData: SensorData | null;
  deviceStatus: DeviceStatus | null;
  weatherData: WeatherData | null;
  weatherLoading: boolean;
  settings: Settings | null;
  mqttStatus: MqttStatusSnapshot;
}

function getSensorStatus(value: number, type: string, settings: Settings | null): 'good' | 'warning' | 'danger' {
  if (!settings) return 'good';

  switch (type) {
    case 'temperature':
      if (value > settings.temp_threshold_high || value < settings.temp_threshold_low) return 'warning';
      return 'good';
    case 'soil_moisture':
      if (value < settings.soil_moisture_threshold) return 'danger';
      if (value < settings.soil_moisture_threshold + 10) return 'warning';
      return 'good';
    default:
      return 'good';
  }
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('id-ID') : '-';
}

function ConnectionItem({
  title,
  value,
  detail,
  online,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  online: boolean;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${online ? 'bg-emerald-400/25' : 'bg-red-400/25'}`}>
        <Icon size={20} className={online ? 'text-emerald-100' : 'text-red-100'} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-emerald-100">{title}</p>
        <p className="truncate text-sm font-semibold text-white">{value}</p>
        <p className="truncate text-xs text-emerald-100/80">{detail}</p>
      </div>
    </div>
  );
}

export function Dashboard({ sensorData, deviceStatus, weatherData, weatherLoading, settings, mqttStatus }: DashboardProps) {
  const lastUpdate = sensorData?.created_at ? new Date(sensorData.created_at).toLocaleString('id-ID') : '-';

  return (
    <div className="space-y-6">
      <AlertBanner sensorData={sensorData} settings={settings} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">Selamat Datang di NexaGrow!</h1>
                <p className="text-emerald-100">NexaGrow — Intelligent Plant Monitoring and Water Efficiency Platform</p>
              </div>
              <div className="hidden sm:block w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Sprout size={40} className="text-white" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-1">

              <ConnectionItem
                title="Sistem"
                value={mqttStatus.systemOnline ? 'Online' : 'Offline'}
                detail={mqttStatus.systemDetail}
                online={mqttStatus.systemOnline}
                icon={Server}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2">
                <Clock size={16} />
                <span className="text-sm">Data sensor: {lastUpdate}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2">
                <Power size={16} />
                <span className="text-sm">
                  Mode: {sensorData?.device_mode === 'auto' ? 'Otomatis' : sensorData?.device_mode === 'manual' ? 'Manual' : 'Tidak diketahui'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <SensorCard
              title="Suhu"
              value={sensorData?.temperature?.toFixed(1) || '-'}
              unit="°C"
              icon={Thermometer}
              status={getSensorStatus(sensorData?.temperature || 0, 'temperature', settings)}
            />
            <SensorCard
              title="Kelembapan Udara"
              value={sensorData?.humidity || '-'}
              unit="%"
              icon={Droplets}
              status="good"
            />

            <SensorCard
              title="Kelembapan Tanah"
              value={sensorData?.soil_moisture || '-'}
              unit="%"
              icon={Sprout}
              status={getSensorStatus(sensorData?.soil_moisture || 0, 'soil_moisture', settings)}
            />
            <SensorCard
              title="Status Pompa"
              value={sensorData?.pump_status ? 'ON' : 'OFF'}
              unit=""
              icon={Power}
              status={sensorData?.pump_status ? 'good' : 'warning'}
            />

            <SensorCard
              title="Status Lampu"
              value={sensorData?.led_status ? 'ON' : 'OFF'}
              unit=""
              icon={Lightbulb}
              status={sensorData?.led_status ? 'good' : 'warning'}
            />
          </div>
        </div>

        <div className="space-y-6">
          <WeatherCard data={weatherData} loading={weatherLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChatInterface />
      </div>
    </div>
  );
}
