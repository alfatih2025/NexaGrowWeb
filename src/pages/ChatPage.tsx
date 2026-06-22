import { ChatInterface } from '../components/ChatInterface';
import { MessageSquare, Sparkles, Sigma } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';
import { getPlantPhaseProfile, formatRange } from '../lib/plantPhase';
import { getArduinoFormulaReference } from '../lib/arduinoFormula';

interface ChatPageProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
}

export function ChatPage({ sensorData = null, settings = null }: ChatPageProps) {
  const phase = getPlantPhaseProfile(settings?.plant_phase);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NexaBot</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
          <Sparkles size={12} />
          AI Pertanian
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fase aktif</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{phase.label}</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Batas tanah</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatRange(phase.soilRange)}</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rumus Arduino</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">AI mengikuti rumus pengolahan sensor yang sama dengan Arduino Nano.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Sigma size={16} className="text-emerald-600" />
          Referensi rumus
        </div>
        <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">
          {getArduinoFormulaReference()}
        </pre>
      </div>

      <ChatInterface sensorData={sensorData} settings={settings} />
    </div>
  );
}
