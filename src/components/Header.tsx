import { Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { DeviceStatus } from '../hooks/useDeviceStatus';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { useAlerts } from '../hooks/useAlerts';

interface HeaderProps {
  deviceStatus: DeviceStatus | null;
  mqttStatus: MqttStatusSnapshot;
  onRefresh: () => void;
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

export function Header({ deviceStatus, mqttStatus, onRefresh, currentPage }: HeaderProps) {
  const { unreadCount, markAsRead } = useAlerts();
  const isOnline = mqttStatus.systemOnline || (mqttStatus.browserOnline && mqttStatus.mqttConnected && (mqttStatus.espOnline || (deviceStatus?.online ?? false)));

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-emerald-100 sticky top-0 z-30">
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

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            title="Sinkronkan data"
          >
            <RefreshCw size={20} className="text-gray-600" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              await markAsRead();
            }}
            className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
            title="Tandai notifikasi sebagai dibaca"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
