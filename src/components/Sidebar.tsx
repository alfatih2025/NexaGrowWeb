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
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/nexagrow-logo.png';

export type PageId =
  | 'dashboard'
  | 'monitoring'
  | 'chat'
  | 'control'
  | 'weather'
  | 'logs'
  | 'settings'
  | 'about';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
}

const menuItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
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
        className="fixed top-4 left-4 z-50 lg:hidden inline-flex items-center justify-center rounded-2xl bg-emerald-600 text-white p-3 shadow-lg shadow-emerald-900/20"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </motion.button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-slate-950 text-white shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
              <img src={logo} alt="NexaGrow" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight">NexaGrow</h1>
              <p className="truncate text-[11px] text-emerald-200/80">Smart Plant Monitoring</p>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-1 p-3">
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
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-emerald-300'} />
                <span className="font-medium">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="mb-2 flex items-center gap-2 text-emerald-300">
              <Sprout size={16} />
              <span className="font-semibold">NexaGrow AI</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300/80">
              Monitoring sensor, jadwal penyiraman, dan analisis tanaman terhubung langsung ke ESP32 serta Arduino Nano.
            </p>
          </div>
        </div>
      </motion.aside>

      {mobileOpen && <div className="fixed inset-y-0 left-72 z-40 hidden lg:block" />}
    </>
  );
}
