import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Monitoring } from './pages/Monitoring';
import { ChatPage } from './pages/ChatPage';
import { ControlPage } from './pages/ControlPage';
import { WeatherPage } from './pages/WeatherPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { useSensorData } from './hooks/useSensorData';
import { useDeviceStatus } from './hooks/useDeviceStatus';
import { useWeather } from './hooks/useWeather';
import { useSettings } from './hooks/useSettings';
import { useAlerts } from './hooks/useAlerts';
import { useMqttStatus } from './hooks/useMqttStatus';
import { announceWebPresence } from './services/mqtt';
import './index.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { data: sensorData, history, loading: sensorLoading, refetch: refetchSensor } = useSensorData(5000);
  const { status: deviceStatus, refetch: refetchDevice } = useDeviceStatus(10000);
  const { settings } = useSettings();
  const { data: weatherData, loading: weatherLoading } = useWeather();
  const { createAlert, fetchAlerts, markAsRead } = useAlerts();
  const mqttStatus = useMqttStatus();
  const lastAlertSignatureRef = useRef<string>('');

  const liveSensorData = useMemo(() => {
    const live = mqttStatus.sensorSnapshot;
    if (!sensorData && !live) return null;

    return {
      ...(sensorData ?? {
        device_id: 'ESP32_001',
        temperature: 0,
        humidity: 0,
        soil_moisture: 0,
        pump_status: false,
        led_status: false,
        device_mode: null,
        wifi_status: 'unknown',
        created_at: new Date().toISOString(),
      }),
      temperature: live?.temperature ?? sensorData?.temperature ?? 0,
      humidity: live?.humidity ?? sensorData?.humidity ?? 0,
      soil_moisture: live?.soil_moisture ?? sensorData?.soil_moisture ?? 0,
      pump_status: live?.pump_status ?? sensorData?.pump_status ?? false,
      led_status: live?.led_status ?? sensorData?.led_status ?? false,
      device_mode: live?.device_mode ?? sensorData?.device_mode ?? null,
      wifi_status: live?.wifi_status ?? sensorData?.wifi_status ?? 'unknown',
      created_at: live?.updatedAt ?? sensorData?.created_at ?? new Date().toISOString(),
    };
  }, [sensorData, mqttStatus.sensorSnapshot]);

  useEffect(() => {
    const checkThresholds = async () => {
      if (!liveSensorData || !settings) return;

      const alertSet: Array<{
        key: string;
        type: string;
        message: string;
        severity: 'info' | 'warning' | 'danger';
      }> = [];

      if (liveSensorData.temperature > settings.temp_threshold_high) {
        alertSet.push({
          key: `temp-high-${Math.round(liveSensorData.temperature * 10)}`,
          type: 'temperature',
          message: `Suhu tinggi: ${liveSensorData.temperature}°C`,
          severity: 'warning',
        });
      }

      if (liveSensorData.temperature < settings.temp_threshold_low) {
        alertSet.push({
          key: `temp-low-${Math.round(liveSensorData.temperature * 10)}`,
          type: 'temperature',
          message: `Suhu terlalu rendah: ${liveSensorData.temperature}°C`,
          severity: 'warning',
        });
      }

      if (liveSensorData.soil_moisture < settings.soil_moisture_threshold) {
        alertSet.push({
          key: `soil-low-${Math.round(liveSensorData.soil_moisture * 10)}`,
          type: 'soil',
          message: `Kelembapan tanah rendah: ${liveSensorData.soil_moisture}%`,
          severity: 'danger',
        });
      }

      const rainChance = weatherData?.current.rain_chance ?? 0;
      const weatherText = weatherData?.current.weather || '';
      if (rainChance >= 60 || /hujan|rain|gerimis/i.test(weatherText)) {
        alertSet.push({
          key: `rain-${rainChance}-${weatherText}`,
          type: 'weather',
          message: `BMKG mengindikasikan potensi hujan (${rainChance}%). Pertimbangkan menunda penyiraman.`,
          severity: 'warning',
        });
      }

      if (alertSet.length === 0) {
        lastAlertSignatureRef.current = '';
        return;
      }

      const signature = alertSet.map((item) => item.key).join('|');
      if (signature === lastAlertSignatureRef.current) return;
      lastAlertSignatureRef.current = signature;

      for (const item of alertSet) {
        await createAlert(item.type, item.message, item.severity);
      }

      await createAlert(
        'ai',
        'AI mendeteksi anomali sensor dan status cuaca. Silakan cek dashboard untuk rekomendasi tindakan.',
        'info',
      );
    };

    checkThresholds();
  }, [liveSensorData, settings, weatherData, createAlert]);

  const handleRefresh = async () => {
    await Promise.all([
      refetchSensor(),
      refetchDevice(),
      fetchAlerts(),
      announceWebPresence('online'),
    ]);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            sensorData={liveSensorData}
            deviceStatus={deviceStatus}
            weatherData={weatherData}
            weatherLoading={weatherLoading}
            settings={settings}
            mqttStatus={mqttStatus}
          />
        );
      case 'monitoring':
        return <Monitoring history={history} />;
      case 'chat':
        return <ChatPage />;
      case 'control':
        return <ControlPage sensorData={liveSensorData} />;
      case 'weather':
        return <WeatherPage />;
      case 'logs':
        return <LogsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'about':
        return <AboutPage />;
      default:
        return (
          <Dashboard
            sensorData={liveSensorData}
            deviceStatus={deviceStatus}
            weatherData={weatherData}
            weatherLoading={weatherLoading}
            settings={settings}
            mqttStatus={mqttStatus}
          />
        );
    }
  };

  if (sensorLoading && !sensorData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="w-20 h-20 border-4 border-emerald-200 border-t-emerald-500 rounded-full mx-auto mb-6"
          />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">NexaGrow</h2>
          <p className="text-emerald-600">Memuat data sensor...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="flex">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

        <div className="flex-1 lg:ml-0 min-h-screen flex flex-col">
          <Header
            deviceStatus={deviceStatus}
            mqttStatus={mqttStatus}
            onRefresh={handleRefresh}
            currentPage={currentPage}
          />

          <main className="flex-1 p-6 overflow-auto">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {renderPage()}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
