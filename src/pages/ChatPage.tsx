import { ChatInterface } from '../components/ChatInterface';
import { MessageSquare, Sparkles } from 'lucide-react';

export function ChatPage() {
  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">NexaBot</h2>
        <span className="ml-auto flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
          <Sparkles size={12} />
          NexaBot AI
        </span>
      </div>

      <ChatInterface />
    </div>
  );
}
