import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Sprout, MapPin, Wifi, Clock3, CalendarDays, Shield, Bell } from 'lucide-react';
import { useSettings, Settings as SettingsType } from '../hooks/useSettings';
import { useControl } from '../hooks/useControl';
import { getPhaseDefaults, getPlantPhaseProfile, formatRange } from '../lib/plantPhase';

const phaseOptions = [
  { id: 'vegetatif', icon: '🌱' },
  { id: 'generatif', icon: '🌼' },
] as const;

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const { sendCommand, loading: controlLoading } = useControl();

  const [formData, setFormData] = useState<Partial<SettingsType>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [wifiError, setWifiError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  const currentPhase = (formData.plant_phase || settings?.plant_phase || 'vegetatif') as 'vegetatif' | 'generatif';
  const phaseProfile = getPlantPhaseProfile(currentPhase);

  const updateField = (field: keyof SettingsType, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const applyPhaseDefaults = (phase: 'vegetatif' | 'generatif') => {
    const defaults = getPhaseDefaults(phase);
    setFormData((prev) => ({
      ...prev,
      ...defaults,
      plant_phase: phase,
      crop_mode: phase,
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const payload = {
        ...formData,
        plant_phase: currentPhase,
        crop_mode: currentPhase,
        watering_time: formData.watering_time || settings?.watering_time || '06:00',
        watering_duration: Number(formData.watering_duration ?? settings?.watering_duration ?? 10),
        watering_enabled: Boolean(formData.watering_enabled ?? settings?.watering_enabled ?? true),
      } as Partial<SettingsType>;

      await updateSettings(payload);

      await sendCommand('schedule_set', undefined, {
        watering_time: payload.watering_time,
        watering_duration: payload.watering_duration,
        schedule_enabled: payload.watering_enabled,
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  const handleSendWifi = async () => {
    setWifiStatus('sending');
    setWifiError(null);
    try {
      await sendCommand('wifi_update', undefined, { ssid: wifiSsid, password: wifiPassword });
      setWifiStatus('sent');
      setWifiSsid('');
      setWifiPassword('');
      setTimeout(() => setWifiStatus('idle'), 2000);
    } catch (err) {
      setWifiError(err instanceof Error ? err.message : 'Gagal mengirim WiFi');
      setWifiStatus('error');
    }
  };

  if (loading && !settings) {
    return <div className="p-6 text-gray-500">Memuat pengaturan...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6 text-emerald-600" />
        <h2 className="text-2xl font-bold text-gray-800">Pengaturan</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Profil Pengguna</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
              <input type="text" value={formData.user_name || ''} onChange={(e) => updateField('user_name', e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Gmail / Notifikasi</label>
              <input type="email" value={formData.user_email || ''} onChange={(e) => updateField('user_email', e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Sprout className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Fase Tanaman</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {phaseOptions.map((phase) => (
              <motion.button
                key={phase.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => applyPhaseDefaults(phase.id)}
                className={`p-4 rounded-xl border-2 transition-all ${currentPhase === phase.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}
              >
                <span className="text-2xl mb-2 block">{phase.icon}</span>
                <span className={`font-medium ${currentPhase === phase.id ? 'text-emerald-700' : 'text-gray-700'}`}>
                  {phase.id === 'vegetatif' ? 'Vegetatif' : 'Generatif'}
                </span>
              </motion.button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900">
            <p className="font-semibold">{phaseProfile.label}</p>
            <p className="mt-1 text-emerald-800">{phaseProfile.description}</p>
            <p className="mt-2 text-emerald-700">Rentang rekomendasi tanah: {formatRange(phaseProfile.soilRange)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Batas Sensor Fase</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Suhu Rendah</label>
              <input type="number" value={formData.temp_threshold_low ?? 22} onChange={(e) => updateField('temp_threshold_low', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Suhu Tinggi</label>
              <input type="number" value={formData.temp_threshold_high ?? 34} onChange={(e) => updateField('temp_threshold_high', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Batas Bawah Soil</label>
              <input type="number" value={formData.soil_threshold_low ?? 45} onChange={(e) => updateField('soil_threshold_low', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Batas Atas Soil</label>
              <input type="number" value={formData.soil_threshold_high ?? 75} onChange={(e) => updateField('soil_threshold_high', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Batas Kritis Soil</label>
              <input type="number" value={formData.soil_threshold_critical ?? 35} onChange={(e) => updateField('soil_threshold_critical', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">pH Minimum</label>
              <input type="number" step="0.1" value={formData.ph_min ?? 5.5} onChange={(e) => updateField('ph_min', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Jadwal Penyiraman</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="font-medium text-gray-700">Aktifkan jadwal</p>
                <p className="text-xs text-gray-500">Penyiraman otomatis berdasarkan waktu yang dipilih</p>
              </div>
              <input type="checkbox" checked={formData.watering_enabled ?? true} onChange={(e) => updateField('watering_enabled', e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jam Siram</label>
                <input type="time" value={formData.watering_time || '06:00'} onChange={(e) => updateField('watering_time', e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durasi (detik)</label>
                <input type="number" value={formData.watering_duration ?? 10} onChange={(e) => updateField('watering_duration', Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Wifi className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Kirim WiFi ke ESP32</h3>
          </div>
          <div className="space-y-4">
            <input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="SSID WiFi" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            <input value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="Password WiFi" type="password" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            <button onClick={handleSendWifi} disabled={wifiStatus === 'sending' || controlLoading} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {wifiStatus === 'sending' ? 'Mengirim...' : 'Kirim ke ESP32'}
            </button>
            {wifiError && <p className="text-sm text-red-600">{wifiError}</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-800">Notifikasi AI</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Saat kondisi tanaman masuk fase kritis, sistem akan membuat notifikasi dan mengirim email ke alamat yang tersimpan di profil pengguna. Histori notifikasi tampil di ikon lonceng pojok kanan atas.
          </p>
        </motion.div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {saveStatus === 'saved' ? 'Pengaturan berhasil disimpan.' : 'Perubahan akan disimpan ke server dan dipakai AI.'}
        </div>
        <button onClick={handleSave} className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm">
          {saveStatus === 'saving' ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
}
