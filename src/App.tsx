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
import { getPlantHealthSummary } from './lib/plantPhase';
import { getSensorHistorySnapshot } from './services/mqtt';
import { recordActivity } from './lib/activityLog';

import './index.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { data: sensorData, history, loading: sensorLoading } = useSensorData(3000);

  const { status: deviceStatus } = useDeviceStatus(5000);

  const { settings, updateSettings } = useSettings();
  const { data: weatherData } = useWeather(settings?.location);
  const { createAlert } = useAlerts();

  const mqttStatus = useMqttStatus();
  const lastAlertSignatureRef = useRef<string>('');

  useEffect(() => {
    const pageName =
      currentPage === 'dashboard'
        ? 'Dashboard'
        : currentPage === 'monitoring'
          ? 'Monitoring'
          : currentPage === 'chat'
            ? 'AI Chat'
            : currentPage === 'control'
              ? 'Control'
              : currentPage === 'weather'
                ? 'Cuaca'
                : currentPage === 'logs'
                  ? 'Log & Analitik'
                  : currentPage === 'settings'
                    ? 'Setting'
                    : 'About';

    recordActivity({
      source: 'navigation',
      type: 'page_view',
      title: `Membuka halaman ${pageName}`,
      message: `Membuka halaman ${pageName}`,
      details: {
        page: currentPage,
        title: pageName,
      },
    });
  }, [currentPage]);

  const liveSensorData = useMemo(() => {
    const live = mqttStatus.sensorSnapshot;
    const fallback = sensorData ?? null;
    if (!fallback && !live) return null;

    return {
      ...(fallback ?? {
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
      temperature: live?.temperature ?? fallback?.temperature ?? 0,
      humidity: live?.humidity ?? fallback?.humidity ?? 0,
      soil_moisture: live?.soil_moisture ?? fallback?.soil_moisture ?? 0,
      rain: live?.rain ?? fallback?.rain ?? 0,
      score: live?.score ?? fallback?.score ?? 0,
      soil_score: live?.soil_score ?? fallback?.soil_score ?? 0,
      vdp_score: live?.vdp_score ?? fallback?.vdp_score ?? 0,
      rain_score: live?.rain_score ?? fallback?.rain_score ?? 0,
      vpd: live?.vpd ?? fallback?.vpd ?? 0,
      duration_estimate: live?.duration_estimate ?? fallback?.duration_estimate ?? 0,
      pump_status: live?.pump_status ?? fallback?.pump_status ?? false,
      led_status: live?.led_status ?? fallback?.led_status ?? false,
      device_mode: live?.device_mode ?? fallback?.device_mode ?? null,
      wifi_status: live?.wifi_status ?? fallback?.wifi_status ?? 'unknown',
      threshold_kritis: live?.threshold_kritis ?? fallback?.threshold_kritis ?? null,
      threshold_atas: live?.threshold_atas ?? fallback?.threshold_atas ?? null,
      threshold_bawah: live?.threshold_bawah ?? fallback?.threshold_bawah ?? null,
      watering_time: live?.watering_time ?? fallback?.watering_time ?? null,
      watering_duration: live?.watering_duration ?? fallback?.watering_duration ?? null,
      schedule_enabled: live?.schedule_enabled ?? fallback?.schedule_enabled ?? true,
      created_at: live?.updatedAt ?? fallback?.created_at ?? new Date().toISOString(),
    };
  }, [sensorData, mqttStatus.sensorSnapshot]);

  const health = useMemo(() => {
    if (!settings) return null;
    return getPlantHealthSummary({
      phase: settings.plant_phase,
      soilMoisture: liveSensorData?.soil_moisture,
      temperature: liveSensorData?.temperature,
      weatherLabel: weatherData?.current.weather,
      rainChance: weatherData?.current.rain_chance,
      soilLow: settings.soil_threshold_low,
      soilHigh: settings.soil_threshold_high,
      soilCritical: settings.soil_threshold_critical,
      tempLow: settings.temp_threshold_low,
      tempHigh: settings.temp_threshold_high,
    });
  }, [settings, liveSensorData, weatherData]);

  useEffect(() => {
    const checkThresholds = async () => {
      if (!liveSensorData || !settings || !health) return;

      const alerts = health.alerts.filter((item) => item.severity !== 'info' || item.type !== 'phase');
      const signature = alerts.map((item) => item.key).join('|');
      if (!signature) {
        lastAlertSignatureRef.current = '';
        return;
      }

      if (signature === lastAlertSignatureRef.current) return;
      lastAlertSignatureRef.current = signature;

      for (const item of alerts) {
        await createAlert(item.type, item.message, item.severity, {
          sendEmail: Boolean(item.sendEmail),
          recipientEmail: settings.user_email,
          metadata: item.metadata,
        });
      }
    };

    checkThresholds();
  }, [liveSensorData, settings, health, createAlert]);

  const mqttHistory = useMemo(() => getSensorHistorySnapshot(), [mqttStatus.lastMessageAt, mqttStatus.sensorSnapshot?.updatedAt]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            sensorData={liveSensorData}
            deviceStatus={deviceStatus}
            settings={settings}
            weatherData={weatherData}
            health={health}
          />
        );
      case 'monitoring':
        return <Monitoring history={history} sensorData={liveSensorData} mqttHistory={mqttHistory} />;
      case 'chat':
        return <ChatPage sensorData={liveSensorData} settings={settings} weatherData={weatherData} />;
      case 'control':
        return <ControlPage sensorData={liveSensorData} />;
      case 'weather':
        return <WeatherPage locationCode={settings?.location} settings={settings} updateSettings={updateSettings} />;
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
            settings={settings}
            weatherData={weatherData}
            health={health}
          />
        );
    }
  };

  if (sensorLoading && !sensorData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex min-h-screen items-center justify-center text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="mx-auto mb-6 h-20 w-20 rounded-full border-4 border-emerald-200 border-t-emerald-500"
          />
          <div>
            <h2 className="mb-2 text-2xl font-bold text-emerald-800">NexaGrow</h2>
            <p className="text-emerald-600">Memuat data sensor...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800">
      <div className="flex min-h-screen">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

        <div className="flex min-h-screen flex-1 flex-col">
          <Header mqttStatus={mqttStatus} currentPage={currentPage} />

          <main className="flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-6">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
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
