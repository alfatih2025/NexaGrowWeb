import { useState, useEffect, useCallback } from 'react';
import {
  checkOpenRouterConnection,
  sendMessageToOpenRouter,
  type OpenRouterStatus,
  type OpenRouterChatMessage,
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
  const response = await fetch('/api/chat');
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
    async (message: string) => {
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
    connectionStatus,
    refreshConnectionStatus,
  };
}
