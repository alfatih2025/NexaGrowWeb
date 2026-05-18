import { useState } from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  MessageSquare, 
  Settings, 
  CloudSun,
  FileText,
  Menu,
  X,
  Sprout,
  Zap,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'control', label: 'Kontrol', icon: Zap },
  { id: 'weather', label: 'Cuaca', icon: CloudSun },
  { id: 'logs', label: 'Log & Analitik', icon: FileText },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
  { id: 'about', label: 'About', icon: BookOpen },
];

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-emerald-600 text-white p-3 rounded-xl shadow-lg"
      >
        <Menu size={24} />
      </motion.button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: mobileOpen ? 0 : -280 }}
        className={`fixed lg:translate-x-0 lg:static inset-y-0 left-0 w-72 bg-gradient-to-b from-emerald-900 via-emerald-800 to-teal-900 text-white z-50 shadow-2xl transition-transform duration-300`}
      >
        <div className="flex items-center justify-between p-6 border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">NexaGrow</h1>
              <p className="text-xs text-emerald-300">Intelligent Plant Monitoring & Water Efficiency</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-2 hover:bg-emerald-800/50 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onPageChange(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' 
                    : 'text-emerald-100 hover:bg-emerald-800/50'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-emerald-200' : 'text-emerald-400'} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-2 h-2 bg-white rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-emerald-800/50 backdrop-blur-sm rounded-xl p-4 border border-emerald-700/50">
            <p className="text-xs text-emerald-300 mb-1">Versi</p>
            <p className="text-sm font-semibold">NexaGrow v1.0.0</p>
            <p className="text-xs text-emerald-400 mt-1">© 2025 NexaGrow</p>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
