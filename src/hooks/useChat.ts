import { buildApiHeaders } from '../lib/apiAuth';
import { useState, useEffect, useCallback } from 'react';
import {
  checkOpenRouterConnection,
  sendMessageToOpenRouter,
  type OpenRouterStatus,
  type OpenRouterChatMessage,
  type SensorSnapshotContext,
} from '../services/openrouter';

export interface ChatMessage {
  id: number;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const STORAGE_KEY = 'nexaGrow-chat-messages';

function readLocalMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user_id: role === 'user' ? 'user_001' : 'assistant_001',
    role,
    content,
    created_at: new Date().toISOString(),
  };
}

async function fetchApiMessages(): Promise<ChatMessage[]> {
  const response = await fetch('/api/chat', { headers: buildApiHeaders() });
  if (!response.ok) {
    throw new Error(`Chat API tidak merespons (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Format riwayat chat dari API tidak valid.');
  }

  return data;
}

function toOpenRouterHistory(messages: ChatMessage[]): OpenRouterChatMessage[] {
  return messages.map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

function normalizeSensorContext(sensorContext?: Partial<SensorSnapshotContext> | null): Partial<SensorSnapshotContext> | null {
  if (!sensorContext || typeof sensorContext !== 'object') return null;

  return {
    device_id: typeof sensorContext.device_id === 'string' ? sensorContext.device_id : undefined,
    temperature: typeof sensorContext.temperature === 'number' ? sensorContext.temperature : null,
    humidity: typeof sensorContext.humidity === 'number' ? sensorContext.humidity : null,
    soil_moisture: typeof sensorContext.soil_moisture === 'number' ? sensorContext.soil_moisture : null,
    rain: typeof sensorContext.rain === 'number' ? sensorContext.rain : null,
    score: typeof sensorContext.score === 'number' ? sensorContext.score : null,
    soil_score: typeof sensorContext.soil_score === 'number' ? sensorContext.soil_score : null,
    vdp_score: typeof sensorContext.vdp_score === 'number' ? sensorContext.vdp_score : null,
    rain_score: typeof sensorContext.rain_score === 'number' ? sensorContext.rain_score : null,
    vpd: typeof sensorContext.vpd === 'number' ? sensorContext.vpd : null,
    duration_estimate: typeof sensorContext.duration_estimate === 'number' ? sensorContext.duration_estimate : null,
    pump_status: typeof sensorContext.pump_status === 'boolean' ? sensorContext.pump_status : undefined,
    led_status: typeof sensorContext.led_status === 'boolean' ? sensorContext.led_status : undefined,
    device_mode: sensorContext.device_mode === 'auto' || sensorContext.device_mode === 'manual' ? sensorContext.device_mode : null,
    wifi_status: typeof sensorContext.wifi_status === 'string' ? sensorContext.wifi_status : null,
    threshold_kritis: typeof sensorContext.threshold_kritis === 'number' ? sensorContext.threshold_kritis : null,
    threshold_atas: typeof sensorContext.threshold_atas === 'number' ? sensorContext.threshold_atas : null,
    threshold_bawah: typeof sensorContext.threshold_bawah === 'number' ? sensorContext.threshold_bawah : null,
    watering_time: typeof sensorContext.watering_time === 'string' ? sensorContext.watering_time : null,
    watering_duration: typeof sensorContext.watering_duration === 'number' ? sensorContext.watering_duration : null,
    schedule_enabled: typeof sensorContext.schedule_enabled === 'boolean' ? sensorContext.schedule_enabled : undefined,
    created_at: typeof sensorContext.created_at === 'string' ? sensorContext.created_at : null,
    updatedAt: typeof sensorContext.updatedAt === 'string' ? sensorContext.updatedAt : null,
    sourceTopic: typeof sensorContext.sourceTopic === 'string' ? sensorContext.sourceTopic : null,
    plant_phase: sensorContext.plant_phase === 'generatif' || sensorContext.plant_phase === 'vegetatif' ? sensorContext.plant_phase : null,
    soil_threshold_low: typeof sensorContext.soil_threshold_low === 'number' ? sensorContext.soil_threshold_low : null,
    soil_threshold_high: typeof sensorContext.soil_threshold_high === 'number' ? sensorContext.soil_threshold_high : null,
    soil_threshold_critical: typeof sensorContext.soil_threshold_critical === 'number' ? sensorContext.soil_threshold_critical : null,
    humidity_threshold_low: typeof sensorContext.humidity_threshold_low === 'number' ? sensorContext.humidity_threshold_low : null,
    humidity_threshold_high: typeof sensorContext.humidity_threshold_high === 'number' ? sensorContext.humidity_threshold_high : null,
    temp_threshold_low: typeof sensorContext.temp_threshold_low === 'number' ? sensorContext.temp_threshold_low : null,
    temp_threshold_high: typeof sensorContext.temp_threshold_high === 'number' ? sensorContext.temp_threshold_high : null,
    formula_name: typeof sensorContext.formula_name === 'string' ? sensorContext.formula_name : null,
    formula_soil: typeof sensorContext.formula_soil === 'string' ? sensorContext.formula_soil : null,
    formula_vpd: typeof sensorContext.formula_vpd === 'string' ? sensorContext.formula_vpd : null,
    formula_score: typeof sensorContext.formula_score === 'string' ? sensorContext.formula_score : null,
    soil_raw_dry: typeof sensorContext.soil_raw_dry === 'number' ? sensorContext.soil_raw_dry : null,
    weather_location: typeof sensorContext.weather_location === 'string' ? sensorContext.weather_location : null,
    weather_condition: typeof sensorContext.weather_condition === 'string' ? sensorContext.weather_condition : null,
    weather_temperature: typeof sensorContext.weather_temperature === 'number' ? sensorContext.weather_temperature : null,
    weather_rain_chance: typeof sensorContext.weather_rain_chance === 'number' ? sensorContext.weather_rain_chance : null,
    weather_forecast_location: typeof sensorContext.weather_forecast_location === 'string' ? sensorContext.weather_forecast_location : null,
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<OpenRouterStatus>({
    state: 'checking',
    label: 'Memeriksa OpenRouter',
    detail: 'Menghubungkan chatbot ke OpenRouter...',
  });

  const persistMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages(nextMessages);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMessages));
    }
  }, []);

  const refreshConnectionStatus = useCallback(async () => {
    setConnectionStatus({
      state: 'checking',
      label: 'Memeriksa OpenRouter',
      detail: 'Menghubungkan chatbot ke OpenRouter...',
      checkedAt: new Date().toISOString(),
    });
    const status = await checkOpenRouterConnection();
    setConnectionStatus(status);
  }, []);

  const clearMessages = useCallback(async () => {
    persistMessages([]);
    try {
      await fetch('/api/chat', {
        method: 'DELETE',
        headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch {
      // Ignore errors for remote clear; local history is already removed.
    }
  }, [persistMessages]);

  const fetchMessages = useCallback(async () => {
    try {
      const apiMessages = await fetchApiMessages();
      persistMessages(apiMessages);
      setError(null);
    } catch {
      persistMessages(readLocalMessages());
    }
  }, [persistMessages]);

  const sendMessage = useCallback(
    async (message: string, sensorContext?: Partial<SensorSnapshotContext> | null) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) return;

      setLoading(true);
      setError(null);

      const userMessage = createMessage('user', trimmedMessage);
      const optimisticMessages = [...messages, userMessage];
      persistMessages(optimisticMessages);

      try {
        const assistantReply = await sendMessageToOpenRouter(
          trimmedMessage,
          toOpenRouterHistory(optimisticMessages),
          normalizeSensorContext(sensorContext),
        );

        const assistantMessage = createMessage(
          'assistant',
          typeof assistantReply === 'string' ? assistantReply : 'Maaf, jawaban AI kosong.',
        );

        persistMessages([...optimisticMessages, assistantMessage]);
        setConnectionStatus({
          state: 'connected',
          label: 'OpenRouter aktif via API',
          detail: 'Respons AI diterima dari endpoint /api/openrouter-chat.',
          checkedAt: new Date().toISOString(),
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown chat error';
        setError(detail);
        setConnectionStatus({
          state: 'error',
          label: 'OpenRouter gagal merespons',
          detail,
          checkedAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    },
    [messages, persistMessages],
  );

  useEffect(() => {
    persistMessages(readLocalMessages());
    fetchMessages();
    refreshConnectionStatus();
  }, [fetchMessages, persistMessages, refreshConnectionStatus]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    refetch: fetchMessages,
    clearMessages,
    connectionStatus,
    refreshConnectionStatus,
  };
}
