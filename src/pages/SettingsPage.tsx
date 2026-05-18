import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Sprout, Bell, MapPin, Shield, Wifi } from 'lucide-react';
import { useSettings, Settings as SettingsType } from '../hooks/useSettings';
import { useWeather } from '../hooks/useWeather';
import { useControl } from '../hooks/useControl';


const cropOptions = [
  { id: 'padi', name: 'Padi', icon: '🌾' },
  { id: 'cabai', name: 'Cabai', icon: '🌶️' },
  { id: 'jagung', name: 'Jagung', icon: '🌽' },
  { id: 'sayur', name: 'Sayuran', icon: '🥬' },
];

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const { data: weatherData } = useWeather();
  const { sendCommand, loading: controlLoading } = useControl();

  const [formData, setFormData] = useState<Partial<SettingsType>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [wifiError, setWifiError] = useState<string | null>(null);


  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await updateSettings(formData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  const updateField = (field: keyof SettingsType, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">Pengaturan</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Profil Pengguna</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
              <input
                type="text"
                value={formData.user_name || ''}
                onChange={(e) => updateField('user_name', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.user_email || ''}
                onChange={(e) => updateField('user_email', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sprout className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Mode Tanaman</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {cropOptions.map((crop) => (
              <motion.button
                key={crop.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateField('crop_mode', crop.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.crop_mode === crop.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-200'
                }`}
              >
                <span className="text-2xl mb-2 block">{crop.icon}</span>
                <span className={`font-medium ${
                  formData.crop_mode === crop.id ? 'text-emerald-700' : 'text-gray-700'
                }`}>{crop.name}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Lokasi BMKG</h3>
          </div>
          
          <input
            type="text"
            value={weatherData?.location || 'Memuat lokasi dari BMKG...'}
            readOnly
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Lokasi diambil otomatis dari VITE_BMKG_URL.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Ambang Batas Sensor</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Suhu Maks (°C)</label>
                <input
                  type="number"
                  value={formData.temp_threshold_high || 35}
                  onChange={(e) => updateField('temp_threshold_high', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Suhu Min (°C)</label>
                <input
                  type="number"
                  value={formData.temp_threshold_low || 20}
                  onChange={(e) => updateField('temp_threshold_low', parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kelembapan Tanah Min (%)</label>
              <input
                type="number"
                value={formData.soil_moisture_threshold || 40}
                onChange={(e) => updateField('soil_moisture_threshold', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">pH Min</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.ph_min || 5.5}
                  onChange={(e) => updateField('ph_min', parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">pH Max</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.ph_max || 8.0}
                  onChange={(e) => updateField('ph_max', parseFloat(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-6">
            <Wifi className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">WiFi ESP32</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SSID</label>
              <input
                type="text"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="Nama WiFi"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="Password WiFi"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={wifiStatus === 'sending' || controlLoading}
                onClick={async () => {
                  setWifiError(null);
                  setWifiStatus('sending');

                  const ssid = wifiSsid.trim();
                  if (!ssid) {
                    setWifiStatus('error');
                    setWifiError('SSID tidak boleh kosong');
                    return;
                  }

                  try {
                    await sendCommand('wifi_update', undefined, {
                      ssid,
                      password: wifiPassword,
                    });

                    setWifiStatus('sent');
                    setTimeout(() => setWifiStatus('idle'), 3000);
                  } catch (e) {
                    setWifiStatus('error');
                    setWifiError(e instanceof Error ? e.message : 'Gagal kirim perintah WiFi');
                  }
                }}
                className={`w-full px-5 py-3 rounded-xl font-medium shadow-lg transition-all ${
                  wifiStatus === 'sent'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                } ${wifiStatus === 'sending' || controlLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {wifiStatus === 'sending' ? 'Mengirim...' : wifiStatus === 'sent' ? '✓ Terkirim' : 'Simpan & Restart ESP32'}
              </motion.button>
            </div>

            {wifiError && (
              <div className="text-sm text-red-600">
                {wifiError}
              </div>
            )}

            <div className="text-xs text-gray-500">
              ESP32 akan menyimpan SSID/password dan melakukan restart.
              Setelah itu status akan muncul di topic <code className="bg-gray-100 px-1 rounded">sproutai/wifi/status</code>.
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2"
        >
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Notifikasi & Laporan</h3>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-800">Laporan Otomatis Harian</p>
              <p className="text-sm text-gray-500">Terima ringkasan harian via email</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => updateField('auto_report', !formData.auto_report)}
              className={`w-14 h-8 rounded-full transition-colors relative ${
                formData.auto_report ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <motion.div
                animate={{ x: formData.auto_report ? 24 : 4 }}
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
              />
            </motion.button>
          </div>

          {formData.auto_report && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Waktu Laporan</label>
              <input
                type="time"
                value={formData.report_time || '08:00'}
                onChange={(e) => updateField('report_time', e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}
        </motion.div>
      </div>

      <div className="flex justify-end">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`px-8 py-3 rounded-xl font-medium shadow-lg transition-all ${
            saveStatus === 'saved'
              ? 'bg-emerald-500 text-white'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
          }`}
        >
          {saveStatus === 'saving' ? 'Menyimpan...' : saveStatus === 'saved' ? '✓ Tersimpan!' : 'Simpan Pengaturan'}
        </motion.button>
      </div>
    </div>
  );
}
