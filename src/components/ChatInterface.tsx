import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Sprout, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useChat } from '../hooks/useChat';

const quickPrompts = [
  { icon: Sprout, label: 'Status Tanaman', text: 'Bagaimana kondisi tanaman dan kebutuhan irigasi saat ini?' },
  { icon: Bot, label: 'Lapor Harian', text: 'Berikan laporan harian efisiensi air dan status perangkat.' },
  { icon: Sparkles, label: 'Perlu Siram?', text: 'Apakah perlu siram hari ini berdasarkan kelembapan tanah?' },
];

export function ChatInterface() {
  const { messages, loading, error, sendMessage, connectionStatus, refreshConnectionStatus } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    await sendMessage(message);
  };

  const handleQuickPrompt = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sprout className="w-10 h-10 text-emerald-500" />
            </div>
            <h4 className="text-lg font-semibold text-gray-700 mb-2">Selamat datang di NexaBot!</h4>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Saya siap membantu memantau tanaman dan mengoptimalkan efisiensi air. 
              Tanyakan kondisi lahan, rekomendasi irigasi, atau status perangkat.
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
              exit={{ opacity: 0, y: -20 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                <span className="text-xs opacity-60 mt-2 block">
                  {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex flex-wrap gap-2 mb-3">
          {quickPrompts.map((prompt, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleQuickPrompt(prompt.text)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <prompt.icon size={14} />
              {prompt.label}
            </motion.button>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan tentang sawah Anda..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Send size={18} />
            <span className="hidden sm:inline">Kirim</span>
          </motion.button>
        </form>
      </div>
    </div>
  );
}
