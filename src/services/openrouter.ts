const OPENROUTER_CHAT_ENDPOINT = '/api/chat';
const OPENROUTER_STATUS_ENDPOINT = '/api/openrouter-status';

export type OpenRouterConnectionState = 'checking' | 'connected' | 'missing_key' | 'error';

export interface OpenRouterStatus {
  state: OpenRouterConnectionState;
  label: string;
  detail: string;
  checkedAt?: string;
}

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function normalizeStatusPayload(payload: unknown): Promise<OpenRouterStatus | null> {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Partial<OpenRouterStatus>;
  if (!obj.state || !obj.label || !obj.detail) return null;
  return {
    state: obj.state,
    label: obj.label,
    detail: obj.detail,
    checkedAt: obj.checkedAt,
  };
}

export async function checkOpenRouterConnection(): Promise<OpenRouterStatus> {
  try {
    const response = await fetch(OPENROUTER_STATUS_ENDPOINT);
    const payload = await response.json().catch(() => null);
    const normalized = await normalizeStatusPayload(payload);

    if (!response.ok) {
      return {
        state: normalized?.state || 'error',
        label: normalized?.label || 'OpenRouter tidak tersambung',
        detail: normalized?.detail || `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      };
    }

    return normalized || {
      state: 'error',
      label: 'OpenRouter tidak tersambung',
      detail: 'Respons status tidak valid dari server.',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      state: 'error',
      label: 'OpenRouter tidak tersambung',
      detail: error instanceof Error ? error.message : 'Unknown connection error',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function sendMessageToOpenRouter(userMessage: string, history: OpenRouterChatMessage[]): Promise<string> {
  const recentHistory = history.slice(-8);
  const lastItem = recentHistory[recentHistory.length - 1];
  const trimmedHistory = lastItem && lastItem.role === 'user' && lastItem.content.trim() === userMessage.trim()
    ? recentHistory.slice(0, -1)
    : recentHistory;

  const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      history: trimmedHistory,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || payload?.detail || `Chat request gagal dengan status ${response.status}`);
  }

  if (!payload?.content || typeof payload.content !== 'string') {
    throw new Error('Chat API tidak mengembalikan jawaban yang valid.');
  }

  return payload.content.trim();
}
