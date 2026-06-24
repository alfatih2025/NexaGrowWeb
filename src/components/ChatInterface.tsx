import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Sparkles, Sprout, RefreshCw, Wifi, WifiOff, AlertTriangle, Leaf } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import type { SensorData } from '../hooks/useSensorData';
import type { Settings } from '../hooks/useSettings';
import type { WeatherData } from '../hooks/useWeather';
import { getPlantPhaseProfile, formatRange } from '../lib/plantPhase';
import { resolveWeatherLocationPath } from '../lib/weatherLocations';

const quickPrompts = [
  { icon: Sprout, label: 'Status Tanaman', text: 'Bagaimana kondisi tanaman dan kebutuhan irigasi saat ini?' },
  { icon: Bot, label: 'Lapor Harian', text: 'Berikan laporan harian efisiensi air dan status perangkat.' },
  { icon: Sparkles, label: 'Skenario Iklim', text: 'Kalau tanaman ini dipindahkan ke iklim yang lebih panas dan kering, saran perawatannya apa?' },
];

interface ChatInterfaceProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
  weatherData?: WeatherData | null;
  variant?: 'full' | 'compact';
}

export function ChatInterface({ sensorData = null, settings = null, weatherData = null, variant = 'full' }: ChatInterfaceProps) {
  const { messages, loading, error, sendMessage, connectionStatus, refreshConnectionStatus } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';
  const phaseProfile = getPlantPhaseProfile(settings?.plant_phase);
  const weatherLocationLabel = useMemo(() => resolveWeatherLocationPath(settings?.location), [settings?.location]);

  const sensorContext = useMemo(
    () => ({
      device_id: sensorData?.device_id,
      temperature: sensorData?.temperature ?? null,
      humidity: sensorData?.humidity ?? null,
      soil_moisture: sensorData?.soil_moisture ?? null,
      rain: sensorData?.rain ?? null,
      score: sensorData?.score ?? null,
      soil_score: sensorData?.soil_score ?? null,
      vdp_score: sensorData?.vdp_score ?? null,
      rain_score: sensorData?.rain_score ?? null,
      vpd: sensorData?.vpd ?? null,
      duration_estimate: sensorData?.duration_estimate ?? null,
      pump_status: sensorData?.pump_status,
      led_status: sensorData?.led_status,
      device_mode: sensorData?.device_mode ?? null,
      wifi_status: sensorData?.wifi_status ?? null,
      threshold_kritis: sensorData?.threshold_kritis ?? null,
      threshold_atas: sensorData?.threshold_atas ?? null,
      threshold_bawah: sensorData?.threshold_bawah ?? null,
      watering_time: settings?.watering_time ?? sensorData?.watering_time ?? null,
      watering_duration: settings?.watering_duration ?? sensorData?.watering_duration ?? null,
      schedule_enabled: settings?.watering_enabled ?? sensorData?.schedule_enabled ?? undefined,
      created_at: sensorData?.created_at ?? null,
      plant_phase: settings?.plant_phase ?? null,
      soil_threshold_low: settings?.soil_threshold_low ?? null,
      soil_threshold_high: settings?.soil_threshold_high ?? null,
      soil_threshold_critical: settings?.soil_threshold_critical ?? null,
      humidity_threshold_low: settings?.humidity_threshold_low ?? null,
      humidity_threshold_high: settings?.humidity_threshold_high ?? null,
      temp_threshold_low: settings?.temp_threshold_low ?? null,
      temp_threshold_high: settings?.temp_threshold_high ?? null,
      weather_location: weatherLocationLabel,
      weather_condition: weatherData?.current.weather ?? null,
      weather_temperature: weatherData?.current.temperature ?? null,
      weather_rain_chance: weatherData?.current.rain_chance ?? null,
      weather_forecast_location: weatherLocationLabel,
    }),
    [sensorData, settings, weatherData, weatherLocationLabel],
  );

  const statusTone =
    connectionStatus.state === 'connected'
      ? {
          dot: 'bg-emerald-500',
          text: 'text-emerald-700',
          chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          icon: Wifi,
        }
      : connectionStatus.state === 'checking'
        ? {
            dot: 'bg-amber-400',
            text: 'text-amber-700',
            chip: 'bg-amber-100 text-amber-700 border-amber-200',
            icon: RefreshCw,
          }
        : connectionStatus.state === 'missing_key'
          ? {
              dot: 'bg-orange-400',
              text: 'text-orange-700',
              chip: 'bg-orange-100 text-orange-700 border-orange-200',
              icon: AlertTriangle,
            }
          : {
              dot: 'bg-red-500',
              text: 'text-red-700',
              chip: 'bg-red-100 text-red-700 border-red-200',
              icon: WifiOff,
            };

  const StatusIcon = statusTone.icon;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input;
    setInput('');
    await sendMessage(message, sensorContext);
  };

  const handleQuickPrompt = (text: string) => {
    void sendMessage(text, sensorContext);
  };

  const rootClassName = isCompact
    ? 'flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'
    : 'flex h-[calc(100vh-200px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm';

  const headerClassName = isCompact
    ? 'rounded-t-2xl border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-3'
    : 'rounded-t-2xl border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-4';

  const bodyClassName = isCompact ? 'space-y-3 overflow-y-auto p-3' : 'space-y-4 overflow-y-auto p-4 flex-1';

  const footerClassName = isCompact ? 'border-t border-gray-100 bg-white p-3' : 'border-t border-gray-100 bg-white p-4';

  return (
    <div className={rootClassName}>
      <div className={headerClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 ${isCompact ? 'h-9 w-9' : 'h-10 w-10'}`}>
              <Bot className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
            </div>
            <div>
              <h3 className={`font-semibold text-gray-800 ${isCompact ? 'text-sm' : ''}`}>NexaBot</h3>
              <p className={`flex items-center gap-1 text-xs ${statusTone.text}`}>
                <span className={`h-2 w-2 rounded-full ${statusTone.dot} ${connectionStatus.state === 'connected' ? 'animate-pulse' : ''}`} />
                {connectionStatus.label}
              </p>
              {!isCompact && <p className="mt-1 text-[11px] text-gray-500">{connectionStatus.detail}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCompact && (
              <div className={`hidden items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium sm:flex ${statusTone.chip}`}>
                <StatusIcon size={12} className={connectionStatus.state === 'checking' ? 'animate-spin' : ''} />
                OpenRouter
              </div>
            )}
            <button
              type="button"
              onClick={refreshConnectionStatus}
              disabled={loading}
              className="rounded-lg border border-white/60 bg-white/80 p-2 text-gray-600 transition hover:bg-white disabled:opacity-50"
              title="Periksa ulang koneksi OpenRouter"
            >
              <RefreshCw size={16} className={connectionStatus.state === 'checking' ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {!isCompact && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Fase aktif</p>
              <p className="mt-1 font-semibold text-gray-800">{phaseProfile.label}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Rentang tanah</p>
              <p className="mt-1 font-semibold text-gray-800">{formatRange(phaseProfile.soilRange)}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Lokasi cuaca</p>
              <p className="mt-1 text-xs leading-snug text-gray-600">{weatherLocationLabel || weatherData?.location}</p>
            </div>
          </div>
        )}
      </div>

      <div className={bodyClassName}>
        {messages.length === 0 && (
          <div className={isCompact ? 'rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-center' : 'py-10 text-center'}>
            <div className={`mx-auto mb-4 flex items-center justify-center rounded-full bg-emerald-50 ${isCompact ? 'h-14 w-14' : 'h-20 w-20'}`}>
              <Leaf className={`text-emerald-500 ${isCompact ? 'h-7 w-7' : 'h-10 w-10'}`} />
            </div>
            <h4 className={`mb-2 font-semibold text-gray-700 ${isCompact ? 'text-sm' : 'text-lg'}`}>Selamat datang di NexaBot!</h4>
            <p className={`mx-auto ${isCompact ? 'mb-4 text-xs' : 'mb-6 max-w-md text-gray-500'}`}>
              Saya siap membantu memantau tanaman, membaca data cuaca aktif, dan memberi saran berdasarkan fase vegetatif atau generatif.
            </p>
            <div className={`flex flex-wrap justify-center ${isCompact ? 'gap-2' : 'gap-2'}`}>
              {quickPrompts.map((prompt) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt.text)}
                    className={`inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 font-medium text-emerald-700 transition hover:bg-emerald-100 ${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                  >
                    <Icon size={14} />
                    {prompt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  message.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-600 shadow-sm">Sedang berpikir...</div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={footerClassName}>
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan kondisi tanaman, cuaca, atau jadwal penyiraman..."
            rows={isCompact ? 1 : 2}
            className={`flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${isCompact ? 'min-h-[44px]' : 'min-h-[56px]'}`}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`inline-flex items-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${isCompact ? 'h-[44px] px-4 text-sm' : 'h-[56px] px-5'}`}
          >
            <Send size={16} />
            Kirim
          </button>
        </div>
      </form>
    </div>
  );
}
