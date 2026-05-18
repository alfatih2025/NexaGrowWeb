import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Bot, Zap, CloudRain, Settings2 } from 'lucide-react';

interface LogEntry {
  id: number;
  type: string;
  message: string;
  details: any;
  created_at: string;
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=100');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (type: string) => {
    try {
      const res = await fetch(`/api/export?type=${type}&format=csv`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'ai_chat': return Bot;
      case 'control': return Zap;
      case 'weather': return CloudRain;
      case 'settings': return Settings2;
      default: return FileText;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'ai_chat': return 'bg-purple-100 text-purple-600';
      case 'control': return 'bg-blue-100 text-blue-600';
      case 'weather': return 'bg-cyan-100 text-cyan-600';
      case 'settings': return 'bg-amber-100 text-amber-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold text-gray-800">Log & Analitik</h2>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => exportData('sensor')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <Download size={16} />
            Export Sensor
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => exportData('logs')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Download size={16} />
            Export Log
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'ai_chat', 'control', 'weather', 'settings'].map((f) => (
          <motion.button
            key={f}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f === 'all' ? 'Semua' : f.replace('_', ' ').toUpperCase()}
          </motion.button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Memuat log...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Tidak ada log untuk ditampilkan</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log, idx) => {
                const Icon = getIcon(log.type);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-4 hover:bg-gray-50/50 flex items-start gap-4"
                  >
                    <div className={`p-2 rounded-xl ${getColor(log.type)}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full uppercase">
                          {log.type}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{log.message}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
