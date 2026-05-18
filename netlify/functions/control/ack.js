import supabase from '../_supabase.js';

async function updateControlLog(payload = {}) {
  const id = Number(payload.command_id || payload.id);
  if (!Number.isFinite(id)) {
    throw new Error('command_id is required');
  }

  const status = String(payload.status || 'acked').trim();
  const executedAt = payload.executed_at || new Date().toISOString();
  const detail = payload.detail || payload.result || null;

  const { data, error } = await supabase
    .from('control_logs')
    .update({
      status,
      executed_at: executedAt,
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;

  await supabase.from('activity_logs').insert({
    type: 'control_ack',
    message: `Ack ${status} for command ${id}`,
    details: { ...payload, detail },
    created_at: new Date().toISOString(),
  }).catch(() => {});

  return data || { id, status, executed_at: executedAt };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const updated = await updateControlLog(req.body || {});
    return res.status(200).json({ success: true, log: updated });
  } catch (err) {
    console.error('Control ack error:', err);
    return res.status(500).json({ error: err.message || 'Control ack error' });
  }
}
