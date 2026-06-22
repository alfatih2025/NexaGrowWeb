import { requireApiAuth, authError } from './_auth.js';
import supabase from './_supabase.js';
import { sendOpenRouterMessage } from './_openrouter.js';

function json(res, statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

async function fetchLatestSensor() {
  if (!supabase) return null;
  const { data } = await supabase
    .from('sensor_data')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(null, 204, {});
  }

  const auth = requireApiAuth(event);
  if (!auth.ok) return authError();

  try {
    if (event.httpMethod === 'GET') {
      const limit = Math.min(Number(event.queryStringParameters?.limit ?? 50) || 50, 200);
      if (!supabase) return json(null, 200, []);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return json(null, 200, data || []);
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const user_id = typeof body.user_id === 'string' && body.user_id.trim() ? body.user_id.trim() : 'anonymous';
      const history = Array.isArray(body.history) ? body.history : [];
      const sensorContext = body.sensorContext || (await fetchLatestSensor());

      if (!message) {
        return json(null, 400, { error: 'Message is required' });
      }

      const userRow = { user_id, role: 'user', content: message };
      if (supabase) {
        await supabase.from('chat_messages').insert(userRow);
      }

      const ai = await sendOpenRouterMessage({
        message,
        history,
        sensorContext,
        origin: event.headers?.origin,
      });

      const assistantRow = { user_id, role: 'assistant', content: ai.content };
      if (supabase) {
        await supabase.from('chat_messages').insert(assistantRow);
        await supabase.from('activity_logs').insert({
          type: 'ai_chat',
          message: 'NexaBot chat processed',
          details: { provider: ai.provider, user_id },
        }).catch(() => {});
      }

      return json(null, 200, {
        reply: ai.content,
        provider: ai.provider,
        user_message: userRow,
        assistant_message: assistantRow,
      });
    }

    return json(null, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(null, 500, {
      error: error instanceof Error ? error.message : 'Unknown chat error',
    });
  }
}
