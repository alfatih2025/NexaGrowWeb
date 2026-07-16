import { Thermometer, Droplets, Power, CloudRain, CalendarClock, ShieldAlert, MessageSquare} from 'lucide-react';
import { SensorCard } from '../components/SensorCard';
import { ChatInterface } from '../components/ChatInterface';
import { SensorData } from '../hooks/useSensorData';

import { Settings } from '../hooks/useSettings';
import { WeatherData } from '../hooks/useWeather';
import { PlantHealthSummary, getPlantPhaseProfile } from '../lib/plantPhase';
import logo from '../assets/nexagrow-logo.png';

import type { DeviceStatus } from '../hooks/useDeviceStatus';

interface DashboardProps {
  sensorData: SensorData | null;
  deviceStatus?: DeviceStatus | null;
  settings: Settings | null;
  weatherData?: WeatherData | null;
  health: PlantHealthSummary | null;
}


function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1);
}

function SummaryTile({
  title,
  value,
  detail,
  tone = 'good',
}: {
  title: string;
  value: string;
  detail?: string;
  tone?: 'good' | 'warning' | 'danger';
}) {
  const toneMap = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200',
  } as const;

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-1 text-lg font-bold leading-tight sm:text-xl">{value}</p>
      {detail && <p className="mt-1 text-[11px] opacity-80 sm:text-xs">{detail}</p>}
    </div>
  );
}

export function Dashboard({ sensorData, settings, weatherData, health }: DashboardProps) {
  const phase = getPlantPhaseProfile(settings?.plant_phase);
  const scheduleTime = sensorData?.watering_time || settings?.watering_time || '-';
  const scheduleDuration = sensorData?.watering_duration ?? settings?.watering_duration ?? null;
  const weatherLocation = weatherData?.location || 'Lokasi cuaca belum dipilih';
  const weatherTitle = weatherData?.current.weather || 'Data belum tersedia';
  const weatherTone =
    weatherData && (weatherData.current.rain_chance >= 60 || /hujan|mendung|berawan|gerimis/i.test(weatherData.current.weather))
      ? 'warning'
      : 'good';
  const humidityTone =
    sensorData && settings && (sensorData.humidity < settings.humidity_threshold_low || sensorData.humidity > settings.humidity_threshold_high)
      ? 'warning'
      : 'good';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-5 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-5 text-white lg:grid-cols-[1.15fr_0.85fr] lg:p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-3xl bg-white/15 ring-1 ring-white/20 sm:h-16 sm:w-16">
                <img src={logo} alt="NexaGrow" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">NexaGrow</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-4xl">Intelligent Plant Monitoring</h1>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
              Platform smart agriculture berbasis IoT yang diperkuat AI untuk monitoring, analisis, dan otomatisasi pertanian secara real-time.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryTile title="Fase Tanaman" value={phase.label} detail={phase.description} />
            <SummaryTile title="Status Cuaca" value={weatherTitle} detail={weatherLocation || 'Lokasi cuaca belum dipilih'} tone={weatherTone} />
            <SummaryTile title="Kondisi Kesehatan" value={health?.healthLabel ?? 'Data belum lengkap'} detail={health?.healthDetail} tone={health?.statusTone ?? 'warning'} />
          </div>
        </div>
      </div>

      {health?.healthState === 'kritis' && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Status kritis terdeteksi</p>
              <p className="text-sm opacity-90">{health.healthDetail}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 auto-rows-min">
        <SensorCard
          title="Suhu"
          value={formatOneDecimal(sensorData?.temperature)}
          unit="°C"
          icon={Thermometer}
          status={sensorData && settings && (sensorData.temperature > settings.temp_threshold_high || sensorData.temperature < settings.temp_threshold_low) ? 'warning' : 'good'}
        />
        <SensorCard title="Kelembapan Udara" value={formatOneDecimal(sensorData?.humidity)} unit="%" icon={Droplets} status={humidityTone} />
        <SensorCard title="Kelembapan Tanah" value={formatOneDecimal(sensorData?.soil_moisture)} unit="%" icon={Droplets} status={health?.statusTone ?? 'warning'} />
        <SensorCard title="Status Pompa" value={sensorData?.pump_status ? 'ON' : 'OFF'} unit="" icon={Power} status={sensorData?.pump_status ? 'good' : 'warning'} />
        <SensorCard title="Jadwal Penyiraman" value={scheduleTime} unit={scheduleDuration != null ? `${scheduleDuration} detik` : ''} icon={CalendarClock} status="good" />
        <SensorCard
          title="Cuaca"
          value={weatherData?.current.weather || '-'}
          unit=""
          icon={CloudRain}
          status={weatherData && (weatherData.current.rain_chance >= 60 || /hujan|mendung|berawan|gerimis/i.test(weatherData.current.weather)) ? 'warning' : 'good'}
        />
      </div>



      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <MessageSquare className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Chat</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tanya analisis sensor, cuaca, dan saran perawatan.</p>
          </div>
        </div>
        <ChatInterface variant="compact" sensorData={sensorData} settings={settings} weatherData={weatherData} />
      </div>
    </div>
  );
}
