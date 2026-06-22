import { Bell, Wifi, WifiOff, ChevronDown, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { DeviceStatus } from '../hooks/useDeviceStatus';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { useAlerts } from '../hooks/useAlerts';

interface HeaderProps {
  deviceStatus: DeviceStatus | null;
  mqttStatus: MqttStatusSnapshot;
  currentPage: string;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  monitoring: 'Monitoring Real-time',
  chat: 'NexaBot',
  control: 'Kontrol Perangkat',
  weather: 'Prakiraan Cuaca',
  logs: 'Log & Analitik',
  settings: 'Pengaturan',
  about: 'About / Tentang Web IoT NexaGrow',
};

export function Header({ deviceStatus, mqttStatus, currentPage }: HeaderProps) {
  const { alerts, unreadCount, markAsRead, fetchAlerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isOnline = mqttStatus.systemOnline || (mqttStatus.browserOnline && mqttStatus.mqttConnected && (mqttStatus.espOnline || (deviceStatus?.online ?? false)));

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

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {pageTitles[currentPage] || 'Dashboard'}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <motion.div
            initial={false}
            animate={{
              backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
              color: isOnline ? '#166534' : '#991b1b'
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
          >
            {isOnline ? (
              <>
                <Wifi size={16} className="text-emerald-600" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-600" />
                <span>{mqttStatus.mqttConnected ? 'ESP Offline' : 'MQTT Offline'}</span>
              </>
            )}
          </motion.div>

          <div className="relative" ref={panelRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOpen((prev) => !prev)}
              className="relative flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-gray-100 transition-colors"
              title="Notifikasi"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="absolute right-0 mt-3 w-[360px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Histori Notifikasi</p>
                      <p className="text-xs text-gray-500">{unreadCount} belum dibaca</p>
                    </div>
                    <button
                      onClick={() => markAsRead()}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCheck size={14} />
                      Tandai semua
                    </button>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Belum ada notifikasi.
                      </div>
                    ) : (
                      alerts.slice(0, 8).map((alert) => (
                        <button
                          key={alert.id}
                          onClick={() => markAsRead(alert.id)}
                          className={`w-full border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${alert.read ? 'bg-white' : 'bg-emerald-50/40'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${alert.severity === 'danger' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-semibold text-gray-800">{alert.type}</p>
                                <span className="shrink-0 text-[11px] text-gray-400">
                                  {new Date(alert.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-600 line-clamp-3">{alert.message}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
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
