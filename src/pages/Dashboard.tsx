import { Thermometer, Droplets, Sprout, Power, Leaf, CloudRain } from 'lucide-react';
import { SensorCard } from '../components/SensorCard';
import { ChatInterface } from '../components/ChatInterface';
import { SensorData } from '../hooks/useSensorData';
import { DeviceStatus } from '../hooks/useDeviceStatus';
import { Settings } from '../hooks/useSettings';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { WeatherData } from '../hooks/useWeather';
import { getPlantHealthSummary, getPlantPhaseProfile } from '../lib/plantPhase';

interface DashboardProps {
  sensorData: SensorData | null;
  deviceStatus?: DeviceStatus | null;
  settings: Settings | null;
  mqttStatus: MqttStatusSnapshot;
  weatherData?: WeatherData | null;
}

function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1);
}

function SummaryTile({
  title,
  value,
  tone = 'good',
}: {
  title: string;
  value: string;
  tone?: 'good' | 'warning' | 'danger';
}) {
  const toneMap = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-2 text-xl font-bold leading-tight">{value}</p>
    </div>
  );
}

export function Dashboard({ sensorData, settings, weatherData }: DashboardProps) {
  const phase = getPlantPhaseProfile(settings?.plant_phase);
  const health = getPlantHealthSummary({
    phase: settings?.plant_phase,
    soilMoisture: sensorData?.soil_moisture,
    temperature: sensorData?.temperature,
    weatherLabel: weatherData?.current.weather,
    rainChance: weatherData?.current.rain_chance,
    soilLow: settings?.soil_threshold_low,
    soilHigh: settings?.soil_threshold_high,
    soilCritical: settings?.soil_threshold_critical,
    tempLow: settings?.temp_threshold_low,
    tempHigh: settings?.temp_threshold_high,
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">Selamat Datang di NexaGrow!</h1>
            <p className="text-emerald-100">Platform smart agriculture berbasis IoT yang diperkuat AI untuk monitoring, analisis, dan otomatisasi pertanian secara real-time.</p>
          </div>
          <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <Sprout size={36} className="text-white" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <SummaryTile
            title="Fase Tanaman"
            value={phase.label}
          />
          <SummaryTile
            title="Kondisi Kesehatan"
            value={health.healthLabel}
            tone={health.statusTone}
          />
          <SummaryTile
            title="Status Tanaman"
            value={health.statusLabel}
            tone={health.statusTone}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SensorCard
          title="Suhu"
          value={formatOneDecimal(sensorData?.temperature)}
          unit="°C"
          icon={Thermometer}
          status={sensorData && settings && (sensorData.temperature > settings.temp_threshold_high || sensorData.temperature < settings.temp_threshold_low) ? 'warning' : 'good'}
        />
        <SensorCard
          title="Kelembapan Udara"
          value={formatOneDecimal(sensorData?.humidity)}
          unit="%"
          icon={Droplets}
          status="good"
        />
        <SensorCard
          title="Kelembapan Tanah"
          value={formatOneDecimal(sensorData?.soil_moisture)}
          unit="%"
          icon={Droplets}
          status={health.statusTone}
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
          icon={Leaf}
          status={sensorData?.led_status ? 'good' : 'warning'}
        />
        <SensorCard
          title="Cuaca"
          value={weatherData?.current.weather || '-'}
          unit={`${weatherData?.current.rain_chance ?? 0}% hujan`}
          icon={CloudRain}
          status={weatherData && (weatherData.current.rain_chance >= 60 || /hujan|mendung|berawan|gerimis/i.test(weatherData.current.weather)) ? 'warning' : 'good'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChatInterface sensorData={sensorData} settings={settings} />
      </div>
    </div>
  );
}
