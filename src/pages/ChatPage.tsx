import { ChatInterface } from '../components/ChatInterface';
import { MessageSquare, Sparkles } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';
import { getPlantPhaseProfile, formatRange } from '../lib/plantPhase';

interface ChatPageProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
}

export function ChatPage({ sensorData = null, settings = null }: ChatPageProps) {
  const phase = getPlantPhaseProfile(settings?.plant_phase);

  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">NexaBot</h2>
        <span className="ml-auto flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
          <Sparkles size={12} />
          AI Pertanian
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-2">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Fase aktif</p>
          <p className="mt-1 font-semibold text-gray-800">{phase.label}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Batas tanah</p>
          <p className="mt-1 font-semibold text-gray-800">{formatRange(phase.soilRange)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Prompt bebas</p>
          <p className="mt-1 text-sm text-gray-600">Tanyakan skenario berbeda, iklim lain, atau minta saran perawatan khusus.</p>
        </div>
      </div>

      <ChatInterface sensorData={sensorData} settings={settings} />
    </div>
  );
}
