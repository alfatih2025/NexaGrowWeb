import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Sparkles, Sprout, RefreshCw, Wifi, WifiOff, AlertTriangle, Leaf } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import type { SensorData } from '../hooks/useSensorData';
import type { Settings } from '../hooks/useSettings';
import { getPlantPhaseProfile, formatRange } from '../lib/plantPhase';

const quickPrompts = [
  { icon: Sprout, label: 'Status Tanaman', text: 'Bagaimana kondisi tanaman dan kebutuhan irigasi saat ini?' },
  { icon: Bot, label: 'Lapor Harian', text: 'Berikan laporan harian efisiensi air dan status perangkat.' },
  { icon: Sparkles, label: 'Skenario Iklim', text: 'Kalau tanaman ini dipindahkan ke iklim yang lebih panas dan kering, saran perawatannya apa?' },
];

interface ChatInterfaceProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
}

export function ChatInterface({ sensorData = null, settings = null }: ChatInterfaceProps) {
  const { messages, loading, error, sendMessage, connectionStatus, refreshConnectionStatus } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const phaseProfile = getPlantPhaseProfile(settings?.plant_phase);
  const sensorContext = useMemo(() => ({
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
    temp_threshold_low: settings?.temp_threshold_low ?? null,
    temp_threshold_high: settings?.temp_threshold_high ?? null,
  }), [sensorData, settings]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input;
    setInput('');
    await sendMessage(message, sensorContext);
  };

  const handleQuickPrompt = (text: string) => {
    sendMessage(text, sensorContext);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-200px)] min-h-[520px]">
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">NexaBot</h3>
              <p className={`text-xs flex items-center gap-1 ${statusTone.text}`}>
                <span className={`w-2 h-2 rounded-full ${statusTone.dot} ${connectionStatus.state === 'connected' ? 'animate-pulse' : ''}`} />
                {connectionStatus.label}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {connectionStatus.detail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`hidden sm:flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${statusTone.chip}`}>
              <StatusIcon size={12} className={connectionStatus.state === 'checking' ? 'animate-spin' : ''} />
              OpenRouter
            </div>
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

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white/80 border border-emerald-100 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Fase aktif</p>
            <p className="mt-1 font-semibold text-gray-800">{phaseProfile.label}</p>
          </div>
          <div className="rounded-xl bg-white/80 border border-emerald-100 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Rentang tanah</p>
            <p className="mt-1 font-semibold text-gray-800">{formatRange(phaseProfile.soilRange)}</p>
          </div>
          <div className="rounded-xl bg-white/80 border border-emerald-100 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Fokus AI</p>
            <p className="mt-1 text-xs text-gray-600 leading-snug">{phaseProfile.aiGuidance}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-10 h-10 text-emerald-500" />
            </div>
            <h4 className="text-lg font-semibold text-gray-700 mb-2">Selamat datang di NexaBot!</h4>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Saya siap membantu memantau tanaman dan memberikan saran yang menyesuaikan fase vegetatif atau generatif, termasuk saat kamu memberi skenario prompt sendiri.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickPrompts.map((prompt, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickPrompt(prompt.text)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <prompt.icon size={16} />
                  {prompt.label}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] items-start gap-3 rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-gray-50 text-gray-800 rounded-bl-md border border-gray-100'
                }`}
              >
                <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
                  msg.role === 'user' ? 'bg-white/15 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {msg.role === 'user' ? <span className="text-sm font-semibold">A</span> : <Bot size={16} />}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </motion.div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-gray-50 px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Bot size={16} />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                AI sedang menyiapkan jawaban...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-100 p-4 bg-gray-50/80 rounded-b-2xl">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis prompt bebas di sini, misalnya minta analisis iklim yang berbeda..."
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.03 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            Kirim
          </motion.button>
        </div>
      </form>
    </div>
  );
}
