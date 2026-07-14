import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';
import supabase from '../src/lib/apiHelpers/_supabase.js';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!requireApiAuth(req, res)) return;

  try {
    const { data: latestSettings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const locationCode = latestSettings?.location || '33.74.07.1010';
    let weatherData = null;
    try {
      const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(locationCode)}`;
      const bmkgRes = await fetch(bmkgUrl);
      if (bmkgRes.ok) {
        weatherData = await bmkgRes.json();
      }
    } catch (err) {
      console.error('Failed to fetch weather', err);
    }

    const plantPhase = latestSettings?.plant_phase || latestSettings?.crop_mode || 'vegetatif';

    const systemPrompt = `Kamu adalah AI Pakar Pupuk (AI Fertilizer Expert) untuk NexaGrow.
Berdasarkan fase pertumbuhan tanaman saat ini dan prakiraan cuaca, rekomendasikan jenis dan jumlah pupuk yang optimal.
Return your response STRICTLY as a JSON object with the following structure:
{
  "fertilizerType": "string",
  "amountPerSqm": "string",
  "reasoning": "string"
}`;

    const message = `Fase Tanaman (Plant Phase): ${plantPhase}
Prakiraan Cuaca (Weather Forecast): ${JSON.stringify(weatherData || {})}`;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY || 'demo-key'}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://nexagrow.vercel.app',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      })
    });

    if (!openRouterRes.ok) {
      throw new Error(`OpenRouter error: ${await openRouterRes.text()}`);
    }

    const openRouterData = await openRouterRes.json();
    const content = openRouterData?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    return res.status(200).json({ success: true, data: parsed });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
