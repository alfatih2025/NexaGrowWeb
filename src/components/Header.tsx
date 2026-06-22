import { Bell, Wifi, WifiOff, ChevronDown, CheckCheck, SunMoon, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { DeviceStatus } from '../hooks/useDeviceStatus';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { useAlerts } from '../hooks/useAlerts';

type ThemeMode = 'light' | 'dark';

interface HeaderProps {
  deviceStatus: DeviceStatus | null;
  mqttStatus: MqttStatusSnapshot;
  currentPage: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onRefresh: () => void;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  monitoring: 'Monitoring Real-time',
  chat: 'NexaBot',
  control: 'Kontrol Perangkat',
  weather: 'Prakiraan Cuaca',
  logs: 'Log & Analitik',
  settings: 'Pengaturan',
  about: 'About / Tentang NexaGrow',
};

export function Header({ deviceStatus, mqttStatus, currentPage, theme, onToggleTheme, onRefresh }: HeaderProps) {
  const { alerts, unreadCount, markAsRead, fetchAlerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isOnline = mqttStatus.systemOnline;

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  const title = pageTitles[currentPage] || 'Dashboard';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0 pl-12 sm:pl-0">
          <h2 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <motion.div
            initial={false}
            animate={{
              backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.14)' : 'rgba(248, 113, 113, 0.14)',
              color: isOnline ? '#065f46' : '#991b1b',
            }}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold sm:flex"
          >
            {isOnline ? (
              <>
                <Wifi size={15} className="text-emerald-500" />
                <span>Sistem Online</span>
              </>
            ) : (
              <>
                <WifiOff size={15} className="text-red-500" />
                <span>Sistem Offline</span>
              </>
            )}
          </motion.div>

          <button
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Aktifkan light theme' : 'Aktifkan dark theme'}
          >
            <SunMoon size={16} />
            <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Segarkan data"
          >
            <RefreshCcw size={16} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="relative" ref={panelRef}>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setOpen((prev) => !prev)}
              className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Notifikasi"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="absolute right-0 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Histori Notifikasi</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} belum dibaca</p>
                    </div>
                    <button
                      onClick={() => markAsRead()}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                    >
                      <CheckCheck size={14} />
                      Tandai semua
                    </button>
                  </div>

                  <div className="max-h-[22rem] space-y-2 overflow-y-auto p-3">
                    {alerts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Belum ada notifikasi.
                      </div>
                    )}

                    {alerts.slice(0, 10).map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-2xl border p-3 ${
                          alert.severity === 'danger'
                            ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10'
                            : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.message}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-xs text-slate-500 dark:text-slate-400">{alert.type}</p>
                          {!alert.read && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              Baru
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
