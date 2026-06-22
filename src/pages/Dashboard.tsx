import { Thermometer, Droplets, Sprout, Power, CloudRain, CalendarClock, ShieldAlert } from 'lucide-react';
import { SensorCard } from '../components/SensorCard';
import { SensorData } from '../hooks/useSensorData';
import { DeviceStatus } from '../hooks/useDeviceStatus';
import { Settings } from '../hooks/useSettings';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { WeatherData } from '../hooks/useWeather';
import { PlantHealthSummary, getPlantPhaseProfile } from '../lib/plantPhase';
import logo from '../assets/nexagrow-logo.png';

interface DashboardProps {
  sensorData: SensorData | null;
  deviceStatus?: DeviceStatus | null;
  settings: Settings | null;
  mqttStatus: MqttStatusSnapshot;
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
    <div className={`rounded-3xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-2 text-xl font-bold leading-tight">{value}</p>
      {detail && <p className="mt-1 text-xs opacity-80">{detail}</p>}
    </div>
  );
}

function StatusChip({ label, value, tone = 'good' }: { label: string; value: string; tone?: 'good' | 'warning' | 'danger' }) {
  const toneMap = {
    good: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20',
    danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/20',
  } as const;

  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${toneMap[tone]}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export function Dashboard({ sensorData, deviceStatus, settings, mqttStatus, weatherData, health }: DashboardProps) {
  const phase = getPlantPhaseProfile(settings?.plant_phase);
  const scheduleLabel = sensorData?.schedule_enabled === false ? 'Nonaktif' : 'Aktif';
  const scheduleDetail = sensorData?.watering_time
    ? `${sensorData.watering_time}${sensorData.watering_duration != null ? ` • ${sensorData.watering_duration} detik` : ''}`
    : 'Belum diatur';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-3xl bg-white/15 ring-1 ring-white/20">
                <img src={logo} alt="NexaGrow" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">NexaGrow</p>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Intelligent Plant Monitoring</h1>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
              Platform smart agriculture berbasis IoT yang diperkuat AI untuk monitoring, analisis, dan otomatisasi pertanian secara real-time.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatusChip
                label="ESP32"
                value={mqttStatus.espOnline ? 'Online' : 'Offline'}
                tone={mqttStatus.espOnline ? 'good' : 'danger'}
              />
              <StatusChip
                label="Sistem Web"
                value={mqttStatus.systemOnline ? 'Online' : 'Offline'}
                tone={mqttStatus.systemOnline ? 'good' : 'danger'}
              />
              <StatusChip
                label="Jadwal Siram"
                value={scheduleLabel}
                tone={sensorData?.schedule_enabled ? 'good' : 'warning'}
              />
              <StatusChip
                label="Mode"
                value={sensorData?.device_mode === 'auto' ? 'Auto' : sensorData?.device_mode === 'manual' ? 'Manual' : 'N/A'}
                tone="good"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryTile title="Fase Tanaman" value={phase.label} detail={phase.description} />
            <SummaryTile
              title="Kondisi Kesehatan"
              value={health?.healthLabel ?? 'Data belum lengkap'}
              detail={health?.healthDetail}
              tone={health?.statusTone ?? 'warning'}
            />
            <SummaryTile
              title="Status Tanaman"
              value={health?.statusLabel ?? 'Belum Terdeteksi'}
              detail={health?.recommendation}
              tone={health?.statusTone ?? 'warning'}
            />
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          status={health?.statusTone ?? 'warning'}
        />
        <SensorCard
          title="Status Pompa"
          value={sensorData?.pump_status ? 'ON' : 'OFF'}
          unit=""
          icon={Power}
          status={sensorData?.pump_status ? 'good' : 'warning'}
        />
        <SensorCard
          title="Jadwal Penyiraman"
          value={scheduleLabel}
          unit={scheduleDetail}
          icon={CalendarClock}
          status={sensorData?.schedule_enabled ? 'good' : 'warning'}
        />
        <SensorCard
          title="Cuaca"
          value={weatherData?.current.weather || '-'}
          unit={`${weatherData?.current.rain_chance ?? 0}% hujan`}
          icon={CloudRain}
          status={weatherData && (weatherData.current.rain_chance >= 60 || /hujan|mendung|berawan|gerimis/i.test(weatherData.current.weather)) ? 'warning' : 'good'}
        />
      </div>
    </div>
  );
}
