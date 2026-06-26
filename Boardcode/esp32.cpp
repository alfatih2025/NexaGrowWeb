#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <HardwareSerial.h>
#include <math.h>
#include "secret.h"

// ======================================================
// WIFI DEFAULT
// ======================================================
const char* SSID_WIFI_DEFAULT = WIFI_SSID;
const char* SANDI_WIFI_DEFAULT = WIFI_PASS;

// ======================================================
// BROKER MQTT
// ======================================================
const char* server_mqtt = MQTT_SERVER;
const uint16_t port_mqtt = 8883;
const char* pengguna_mqtt = MQTT_USERNAME;
const char* sandi_mqtt = MQTT_PASSWORD;

// ======================================================
// TOPIK MQTT
// ======================================================
const char* TOPIK_PERINTAH_POMPA   = "sproutai/pompa/cmd";
const char* TOPIK_STATUS_POMPA     = "sproutai/pompa/status";
const char* TOPIK_PERINTAH_LAMPU   = "sproutai/lampu/cmd";
const char* TOPIK_STATUS_LAMPU     = "sproutai/lampu/status";
const char* TOPIK_PERINTAH_MODE    = "sproutai/mode/cmd";
const char* TOPIK_STATUS_MODE      = "sproutai/mode/status";
const char* TOPIK_KELEMBAPAN_TANAH = "sproutai/sensor/soil";
const char* TOPIK_SUHU             = "sproutai/sensor/temp";
const char* TOPIK_KELEMBAPAN_UDARA = "sproutai/sensor/humidity";
const char* TOPIK_DATA_SENSOR_JSON = "sproutai/sensor/data";
const char* TOPIK_STATUS_SISTEM    = "sproutai/system/status";
const char* TOPIK_AKSI_AI          = "sproutai/ai/action";
const char* TOPIK_STATUS_WEB       = "sproutai/web/status";
const char* TOPIK_PERINTAH_JADWAL  = "sproutai/schedule/cmd";
const char* TOPIK_STATUS_JADWAL    = "sproutai/schedule/status";
const char* TOPIK_PERINTAH_WIFI    = "sproutai/wifi/cmd";
const char* TOPIK_STATUS_WIFI      = "sproutai/wifi/status";
const char* TOPIK_PERINTAH_SETTINGS = "sproutai/settings/cmd";
const char* TOPIK_STATUS_SETTINGS   = "sproutai/settings/status";
const char* TOPIK_STATUS_ESP32     = "sproutai/esp32/status";
const char* TOPIK_CUACA_DATA       = "sproutai/weather/data";
const char* TOPIK_SYSTEM_FAULT     = "sproutai/system/fault";
const char* TOPIK_SYSTEM_HEARTBEAT = "sproutai/system/heartbeat";
const char* TOPIK_SYSTEM_RESOURCE  = "sproutai/system/resource";
const char* TOPIK_ANALYTICS_WATER  = "sproutai/analytics/water";
const char* TOPIK_ANALYTICS_EFFICIENCY = "sproutai/analytics/efficiency";
const char* TOPIK_AI_RECOMMENDATION = "sproutai/ai/recommendation";
const char* TOPIK_HISTORY_UPLOAD   = "sproutai/history/upload";

// ======================================================
// PIN
// ======================================================
const int PIN_RELAY = 4;
const int PIN_LAMPU  = 2;
const bool RELAY_AKTIF_LOW = true;  // Samain dengan Arduino: RELAY_ON=LOW, RELAY_OFF=HIGH
// REVISI BAUD RATE DI SINI (Disamakan dengan Arduino SoftwareSerial)
const uint32_t BAUD_SERIAL_ARDUINO = 9600UL; 

// ======================================================
// SERIAL DARI ARDUINO NANO
// ======================================================
HardwareSerial SerialArduino(2);
const int PIN_RX_ARDUINO = 16;
const int PIN_TX_ARDUINO = 17;

// ======================================================
// AMBANG BAWAS OTOMATIS
// ======================================================
const int AMBANG_BAWAH_TANAH = 40;
const int AMBANG_ATAS_TANAH  = 55;
const float AMBANG_ATAS_SUHU = 34.0f;

// ======================================================
// WAKTU & RETRY
// ======================================================
const unsigned long WIFI_RETRY_INTERVAL_MS = 30000UL;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 20000UL;
const unsigned long MQTT_RETRY_INTERVAL_AWAL_MS = 2000UL;
const unsigned long MQTT_RETRY_INTERVAL_MAKS_MS = 60000UL;
const unsigned long ARDUINO_TIMEOUT_MS = 15000UL;
const unsigned long HEARTBEAT_INTERVAL_MS = 30000UL;
const unsigned long RESOURCE_INTERVAL_MS = 30000UL;
const unsigned long BMKG_CACHE_VALID_MS = 6UL * 60UL * 60UL * 1000UL;
const uint32_t HEAP_WARNING_BYTES = 50UL * 1024UL;
const uint32_t HEAP_RESTART_BYTES = 40000UL;
const float DEBIT_POMPA_LITER_PER_MENIT = 1.5f;
const int MQTT_OFFLINE_QUEUE_SIZE = 20;
const size_t MQTT_QUEUE_TOPIC_LEN = 96;
const size_t MQTT_QUEUE_PAYLOAD_LEN = 1024;

// ======================================================
// KLIEN
// ======================================================
WiFiClientSecure klienEsp;
PubSubClient klien(klienEsp);
Preferences preferensi;

// ======================================================
// STATUS UMUM
// ======================================================
bool statusPompa = false;
bool statusLampu = false;
bool modeOtomatis = false;
bool statusMqttTerakhir = false;
String ssidWifi = SSID_WIFI_DEFAULT;
String kataSandiWifi = SANDI_WIFI_DEFAULT;

// ======================================================
// DATA DARI ARDUINO
// ======================================================
float nanoSuhu = NAN;
float nanoKelembapanUdara = NAN;
float nanoKelembapanTanah = NAN;
String nanoIdPerangkat = "ESP32_001";
String nanoStatusWifi = "tidak_diketahui";
String nanoSumberSensor = "real_dht11";
String jsonArduinoTerakhir = "{}";
String penyanggaBarisArduino;
unsigned long msTerakhirTerimaArduino = 0;
bool statusLampuNano = false;
bool statusRelayNano = false;
bool modeOtomatisNano = false;
bool memilikiTelemetriArduino = false;
bool telahMengirimSinkronisasiAwalArduino = false;

// ======================================================
// JADWAL & FORMULA
// ======================================================
String jadwalPenyiramanWaktu = "06:00";
int jadwalPenyiramanDurasi = 5;
bool jadwalPenyiramanAktif = true;
String formulaNamaArduino = "NexaGrow Formula v2";
String formulaSoilArduino = "";
String formulaVpdArduino = "";
String formulaScoreArduino = "";
float soilRawDryArduino = NAN;
String faseTanaman = "vegetatif";
String lokasiCuaca = "33.74.07.1010";
bool autoReportAktif = true;
String waktuLaporanOtomatis = "08:00";
String namaPengguna = "Petani Cerdas";
String emailPengguna = "petani@sprout.id";
float ambangSuhuBawah = 22.0f;
float ambangSuhuAtas = 34.0f;
float ambangKelembapanUdaraBawah = 60.0f;
float ambangKelembapanUdaraAtas = 85.0f;

// ======================================================
// AMBANG YANG DIKIRIM KE ARDUINO
// ======================================================
float nanoAmbangKritis = 30.0f;
float nanoAmbangAtas   = 70.0f;
float nanoAmbangBawah  = 45.0f;

// ======================================================
// TIMER & STATE
// ======================================================
unsigned long msTerakhirUpayaKoneksiUlangMqtt = 0;
unsigned long msTerakhirUpayaWifi = 0;
unsigned long wifiMulaiPercobaanPada = 0;
bool wifiSedangMenghubung = false;
bool wifiMenggunakanDefaultCadangan = false;
bool wifiStatusSudahDilaporkan = false;
bool pompaMatiOtomatisAktif = false;
unsigned long pompaMatiOtomatisPada = 0;
bool telahMempublikasikanSnapshot = false;
unsigned long mqttRetryIntervalSekarangMs = MQTT_RETRY_INTERVAL_AWAL_MS;
unsigned long msTerakhirHeartbeat = 0;
unsigned long msTerakhirResource = 0;
bool heapWarningAktif = false;
bool faultDhtAktif = false;
unsigned long pompaMulaiMenyalaPada = 0;
float totalLiterAirEstimasi = 0.0f;
String payloadCuacaBmkgTerakhir = "";
unsigned long msCuacaBmkgTerakhir = 0;
bool cacheBmkgPernahDipublikasikan = false;
float bmkgRainTerakhir = NAN;

struct PesanMqttTertunda {
  char topik[MQTT_QUEUE_TOPIC_LEN];
  char payload[MQTT_QUEUE_PAYLOAD_LEN];
  bool ditahan;
  bool qos1;
};

PesanMqttTertunda antreanMqtt[MQTT_OFFLINE_QUEUE_SIZE];
int indeksAwalAntreanMqtt = 0;
int jumlahAntreanMqtt = 0;

// ======================================================
// SNAPSHOT TERAKHIR DITERBITKAN
// ======================================================
float suhuTerpublikasiTerakhir = NAN;
float kelembapanUdaraTerpublikasiTerakhir = NAN;
float kelembapanTanahTerpublikasiTerakhir = NAN;
bool statusPompaTerpublikasiTerakhir = false;
bool statusLampuTerpublikasiTerakhir = false;
String modeTerpublikasiTerakhir = "";
String statusWifiTerpublikasiTerakhir = "";
String idPerangkatTerpublikasiTerakhir = "";
String jadwalWaktuTerpublikasiTerakhir = "";
String formulaNamaTerpublikasiTerakhir = "";
String formulaSoilTerpublikasiTerakhir = "";
String formulaVpdTerpublikasiTerakhir = "";
String formulaScoreTerpublikasiTerakhir = "";
float ambangKritisTerpublikasiTerakhir = NAN;
float ambangAtasTerpublikasiTerakhir = NAN;
float ambangBawahTerpublikasiTerakhir = NAN;
float soilRawDryTerpublikasiTerakhir = NAN;
bool jadwalAktifTerpublikasiTerakhir = false;
int jadwalDurasiTerpublikasiTerakhir = -32768;

// ======================================================
// HELPER
// ======================================================
static bool nilaiFloatBerubah(float sekarang, float sebelumnya, float toleransi = 0.01f) {
  if (isnan(sekarang) && isnan(sebelumnya)) return false;
  if (isnan(sekarang) || isnan(sebelumnya)) return true;
  return fabs(sekarang - sebelumnya) > toleransi;
}

static bool nilaiStringBerubah(const String& sekarang, const String& sebelumnya) {
  return sekarang != sebelumnya;
}

static bool nilaiIntBerubah(int sekarang, int sebelumnya) {
  return sekarang != sebelumnya;
}

static bool apakahNilaiTerbatas(float nilai) {
  return !isnan(nilai) && isfinite(nilai);
}

static bool uraikanKolomBoolean(JsonVariantConst nilaiJson, bool nilaiDefault) {
  if (nilaiJson.isNull()) return nilaiDefault;
  if (nilaiJson.is<bool>()) return nilaiJson.as<bool>();
  if (nilaiJson.is<int>() || nilaiJson.is<long>() || nilaiJson.is<float>() || nilaiJson.is<double>()) {
    return nilaiJson.as<double>() != 0.0;
  }
  if (nilaiJson.is<const char*>()) {
    const char* teks = nilaiJson.as<const char*>();
    if (!teks) return nilaiDefault;
    String s(teks);
    s.trim();
    s.toLowerCase();
    if (s == "1" || s == "true" || s == "on" || s == "yes") return true;
    if (s == "0" || s == "false" || s == "off" || s == "no") return false;
  }
  return nilaiDefault;
}

static void tetapkanFloatJikaValid(float &target, JsonVariantConst nilaiJson) {
  if (nilaiJson.isNull()) return;
  float nilaiBerikutnya = nilaiJson.as<float>();
  if (apakahNilaiTerbatas(nilaiBerikutnya)) target = nilaiBerikutnya;
}

static void tetapkanFloatJikaValid(float &target, JsonVariantConst nilaiJson, JsonVariantConst nilaiJsonAlternatif) {
  if (!nilaiJson.isNull()) {
    tetapkanFloatJikaValid(target, nilaiJson);
    return;
  }
  tetapkanFloatJikaValid(target, nilaiJsonAlternatif);
}

static void tetapkanBooleanJikaValid(bool &target, JsonVariantConst nilaiJson) {
  if (nilaiJson.isNull()) return;
  target = uraikanKolomBoolean(nilaiJson, target);
}

static void tetapkanBooleanJikaValid(bool &target, JsonVariantConst nilaiJson, JsonVariantConst nilaiJsonAlternatif) {
  if (!nilaiJson.isNull()) {
    tetapkanBooleanJikaValid(target, nilaiJson);
    return;
  }
  tetapkanBooleanJikaValid(target, nilaiJsonAlternatif);
}

static void tetapkanStringJikaAda(String &target, JsonVariantConst nilaiJson) {
  if (nilaiJson.is<const char*>()) {
    target = nilaiJson.as<const char*>();
  }
}

static String ekstrakPayloadJson(const String& baris) {
  int mulai = baris.indexOf('{');
  int akhir = baris.lastIndexOf('}');
  if (mulai < 0 || akhir <= mulai) return "";
  return baris.substring(mulai, akhir + 1);
}

void publikasikanSnapshotSensor(bool paksa = false);
void publikasikanRekomendasiAi(bool paksa = false);
void publikasikanCuacaBmkg(bool paksa = false);
void perbaruiStatusFaultSensor();
void prosesHeartbeatDanResource();

// ======================================================
// PUBLIKASI MQTT
// ======================================================
bool topikBolehMasukAntrean(const char* topik) {
  if (!topik) return false;
  return strcmp(topik, TOPIK_DATA_SENSOR_JSON) == 0 ||
         strcmp(topik, TOPIK_HISTORY_UPLOAD) == 0 ||
         strcmp(topik, TOPIK_CUACA_DATA) == 0 ||
         strcmp(topik, TOPIK_SYSTEM_FAULT) == 0 ||
         strcmp(topik, TOPIK_SYSTEM_RESOURCE) == 0 ||
         strcmp(topik, TOPIK_ANALYTICS_WATER) == 0 ||
         strcmp(topik, TOPIK_ANALYTICS_EFFICIENCY) == 0 ||
         strcmp(topik, TOPIK_AI_RECOMMENDATION) == 0;
}

void masukkanAntreanMqtt(const char* topik, const char* payload, bool ditahan) {
  if (!topik || !payload) return;
  if (!topikBolehMasukAntrean(topik)) return;

  int indeksTulis;
  if (jumlahAntreanMqtt < MQTT_OFFLINE_QUEUE_SIZE) {
    indeksTulis = (indeksAwalAntreanMqtt + jumlahAntreanMqtt) % MQTT_OFFLINE_QUEUE_SIZE;
    jumlahAntreanMqtt++;
  } else {
    indeksTulis = indeksAwalAntreanMqtt;
    indeksAwalAntreanMqtt = (indeksAwalAntreanMqtt + 1) % MQTT_OFFLINE_QUEUE_SIZE;
  }

  strlcpy(antreanMqtt[indeksTulis].topik, topik, MQTT_QUEUE_TOPIC_LEN);
  strlcpy(antreanMqtt[indeksTulis].payload, payload, MQTT_QUEUE_PAYLOAD_LEN);
  antreanMqtt[indeksTulis].ditahan = ditahan;
  antreanMqtt[indeksTulis].qos1 = false;
}

bool publikasikanMqtt(const char* topik, const char* payload, bool ditahan = true, bool bolehAntre = true) {
  if (!topik || !payload) return false;

  if (!klien.connected()) {
    if (bolehAntre) masukkanAntreanMqtt(topik, payload, ditahan);
    return false;
  }

  bool berhasil = klien.publish(topik, payload, ditahan);
  if (!berhasil && bolehAntre) {
    masukkanAntreanMqtt(topik, payload, ditahan);
  }
  return berhasil;
}

void kirimAntreanMqttTertunda() {
  if (!klien.connected() || jumlahAntreanMqtt <= 0) return;

  int dikirim = 0;
  while (klien.connected() && jumlahAntreanMqtt > 0) {
    PesanMqttTertunda &pesan = antreanMqtt[indeksAwalAntreanMqtt];
    if (!publikasikanMqtt(pesan.topik, pesan.payload, pesan.ditahan, false)) {
      break;
    }
    indeksAwalAntreanMqtt = (indeksAwalAntreanMqtt + 1) % MQTT_OFFLINE_QUEUE_SIZE;
    jumlahAntreanMqtt--;
    dikirim++;
    klien.loop();
  }

  if (dikirim > 0) {
    Serial.print("[MQTT] Pesan tertunda dikirim ulang: ");
    Serial.println(dikirim);
  }
}

void publikasikanTeks(const char* topik, const char* status, bool ditahan = true) {
  publikasikanMqtt(topik, status, ditahan);
}

void publikasikanStatusSistem(const char* status) {
  publikasikanTeks(TOPIK_STATUS_SISTEM, status, true);
  publikasikanTeks(TOPIK_STATUS_ESP32, status, true);
  Serial.print("[SISTEM] ");
  Serial.println(status);
}

void publikasikanStatusWifi(const char* status) {
  publikasikanTeks(TOPIK_STATUS_WIFI, status, true);
  Serial.print("[STATUS WIFI] ");
  Serial.println(status);
}

void publikasikanStatusMode() {
  publikasikanTeks(TOPIK_STATUS_MODE, modeOtomatis ? "AUTO" : "MANUAL", true);
  Serial.print("[MODE] ");
  Serial.println(modeOtomatis ? "AUTO" : "MANUAL");
}

void publikasikanStatusPompa() {
  publikasikanTeks(TOPIK_STATUS_POMPA, statusPompa ? "ON" : "OFF", true);
}

void publikasikanStatusLampu() {
  publikasikanTeks(TOPIK_STATUS_LAMPU, statusLampu ? "ON" : "OFF", true);
}

void publikasikanStatusJadwal() {
  StaticJsonDocument<256> dokumen;
  dokumen["schedule_enabled"] = jadwalPenyiramanAktif;
  dokumen["watering_time"] = jadwalPenyiramanWaktu;
  dokumen["watering_duration"] = jadwalPenyiramanDurasi;
  dokumen["status"] = jadwalPenyiramanAktif ? "AKTIF" : "NONAKTIF";
  String payload;
  serializeJson(dokumen, payload);
  publikasikanTeks(TOPIK_STATUS_JADWAL, payload.c_str(), true);
}

void publikasikanStatusPengaturan(const char* alasan = nullptr) {
  StaticJsonDocument<512> dokumen;
  dokumen["type"] = "settings";
  dokumen["source"] = "esp32";
  if (alasan && alasan[0] != '\0') dokumen["reason"] = alasan;
  dokumen["device_id"] = nanoIdPerangkat;
  dokumen["plant_phase"] = faseTanaman;
  dokumen["location"] = lokasiCuaca;
  dokumen["auto_report"] = autoReportAktif;
  dokumen["report_time"] = waktuLaporanOtomatis;
  dokumen["watering_time"] = jadwalPenyiramanWaktu;
  dokumen["watering_duration"] = jadwalPenyiramanDurasi;
  dokumen["watering_enabled"] = jadwalPenyiramanAktif;
  dokumen["temp_threshold_low"] = ambangSuhuBawah;
  dokumen["temp_threshold_high"] = ambangSuhuAtas;
  dokumen["humidity_threshold_low"] = ambangKelembapanUdaraBawah;
  dokumen["humidity_threshold_high"] = ambangKelembapanUdaraAtas;
  dokumen["soil_threshold_critical"] = nanoAmbangKritis;
  dokumen["soil_threshold_low"] = nanoAmbangBawah;
  dokumen["soil_threshold_high"] = nanoAmbangAtas;
  dokumen["threshold_kritis"] = nanoAmbangKritis;
  dokumen["threshold_atas"] = nanoAmbangAtas;
  dokumen["threshold_bawah"] = nanoAmbangBawah;
  dokumen["user_name"] = namaPengguna;
  dokumen["user_email"] = emailPengguna;
  dokumen["updated_at"] = millis();

  String payload;
  serializeJson(dokumen, payload);
  publikasikanTeks(TOPIK_STATUS_SETTINGS, payload.c_str(), true);
  Serial.print("[SETTINGS] dipublikasikan");
  if (alasan && alasan[0] != '\0') {
    Serial.print(" (");
    Serial.print(alasan);
    Serial.print(")");
  }
  Serial.println();
}

// ======================================================
// SERIAL KE ARDUINO
// ======================================================
void kirimSinkronisasiStatusArduino(const char* alasan = nullptr) {
  StaticJsonDocument<256> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "sync_state";
  dokumen["auto_mode"] = modeOtomatis;
  dokumen["plant_phase"] = faseTanaman;
  dokumen["pump_state"] = statusPompa;
  dokumen["threshold_kritis"] = nanoAmbangKritis;
  dokumen["threshold_atas"] = nanoAmbangAtas;
  dokumen["threshold_bawah"] = nanoAmbangBawah;
  dokumen["schedule_enabled"] = jadwalPenyiramanAktif;
  dokumen["watering_time"] = jadwalPenyiramanWaktu;
  dokumen["watering_duration"] = jadwalPenyiramanDurasi;
  dokumen["location"] = lokasiCuaca;
  if (apakahNilaiTerbatas(bmkgRainTerakhir)) dokumen["rain"] = (int)roundf(bmkgRainTerakhir);

  delay(50);
  serializeJson(dokumen, SerialArduino);
  SerialArduino.println();
  SerialArduino.flush();
  delay(100);
  
  Serial.print("[SERIAL->ARDUINO] sync_state");
  if (alasan && alasan[0] != '\0') {
    Serial.print(" (");
    Serial.print(alasan);
    Serial.print(")");
  }
  Serial.println();
}

void kirimPerintahPompaArduino(bool menyala, const char* alasan = nullptr) {
  StaticJsonDocument<160> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "set_pump";
  dokumen["pump_state"] = menyala;
  dokumen["auto_mode"] = modeOtomatis;

  String payload;
  serializeJson(dokumen, payload);
  
  Serial.println("=================================");
  Serial.print("[SEND->ARDUINO] set_pump: ");
  Serial.println(menyala ? "ON" : "OFF");
  Serial.print("[SEND->ARDUINO] Payload: ");
  Serial.println(payload);
  Serial.print("[SEND->ARDUINO] Reason: ");
  Serial.println(alasan ? alasan : "unknown");
  Serial.println("=================================");
  
  // Send to Arduino dengan delay untuk avoid buffer overflow
  delay(50);  // Tunggu Arduino siap
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(100);  // Delay sebelum kirim pesan berikutnya
}

void kirimPerintahLampuArduino(bool menyala, const char* alasan = nullptr) {
  StaticJsonDocument<256> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "set_lamp";
  dokumen["device_id"] = nanoIdPerangkat;
  if (alasan && alasan[0] != '\0') dokumen["reason"] = alasan;
  dokumen["source"] = "esp32";
  dokumen["lamp_state"] = menyala;
  dokumen["led_state"] = menyala;
  dokumen["auto_mode"] = modeOtomatis;

  delay(50);
  serializeJson(dokumen, SerialArduino);
  SerialArduino.println();
  SerialArduino.flush();
  delay(100);
  Serial.print("[SERIAL->ARDUINO] set_lamp: ");
  Serial.println(menyala ? "ON" : "OFF");
}

void kirimPerintahModeArduino(bool otomatisAktif, const char* alasan = nullptr) {
  StaticJsonDocument<128> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "set_mode";
  dokumen["auto_mode"] = otomatisAktif;

  delay(50);
  serializeJson(dokumen, SerialArduino);
  SerialArduino.println();
  SerialArduino.flush();
  delay(100);
  Serial.print("[SERIAL->ARDUINO] set_mode: ");
  Serial.println(otomatisAktif ? "AUTO" : "MANUAL");
}

void kirimSinkronisasiAmbangArduino(const char* alasan = nullptr) {
  StaticJsonDocument<160> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "sync_thresholds";
  dokumen["threshold_kritis"] = nanoAmbangKritis;
  dokumen["threshold_atas"] = nanoAmbangAtas;
  dokumen["threshold_bawah"] = nanoAmbangBawah;

  delay(50);
  serializeJson(dokumen, SerialArduino);
  SerialArduino.println();
  SerialArduino.flush();
  delay(100);
  Serial.println("[SERIAL->ARDUINO] sync_thresholds");
}

void kirimStatusMqttArduino(bool online) {
  StaticJsonDocument<128> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "mqtt_status";
  dokumen["status"] = online;

  delay(50);
  serializeJson(dokumen, SerialArduino);
  SerialArduino.println();
  SerialArduino.flush();
  delay(100);
  Serial.print("[SERIAL->ARDUINO] mqtt_status: ");
  Serial.println(online ? "ONLINE" : "OFFLINE");
}

// ======================================================
// AKTUATOR
// ======================================================
void aturPompa(bool menyala) {
  bool statusSebelumnya = statusPompa;
  unsigned long sekarang = millis();

  if (menyala && !statusSebelumnya) {
    pompaMulaiMenyalaPada = sekarang;
  } else if (!menyala && statusSebelumnya && pompaMulaiMenyalaPada > 0) {
    unsigned long durasiMs = sekarang - pompaMulaiMenyalaPada;
    float durasiMenit = (float)durasiMs / 60000.0f;
    float liter = DEBIT_POMPA_LITER_PER_MENIT * durasiMenit;
    totalLiterAirEstimasi += liter;

    StaticJsonDocument<256> dokumenAir;
    dokumenAir["device_id"] = nanoIdPerangkat;
    dokumenAir["flow_meter"] = false;
    dokumenAir["pump_flow_lpm"] = DEBIT_POMPA_LITER_PER_MENIT;
    dokumenAir["duration_ms"] = durasiMs;
    dokumenAir["liter"] = liter;
    dokumenAir["total_liter"] = totalLiterAirEstimasi;
    dokumenAir["uptime_ms"] = sekarang;
    String payloadAir;
    serializeJson(dokumenAir, payloadAir);
    publikasikanTeks(TOPIK_ANALYTICS_WATER, payloadAir.c_str(), false);

    StaticJsonDocument<256> dokumenEfisiensi;
    dokumenEfisiensi["device_id"] = nanoIdPerangkat;
    dokumenEfisiensi["liter"] = liter;
    dokumenEfisiensi["soil_moisture"] = nanoKelembapanTanah;
    dokumenEfisiensi["score_basis"] = "estimated_without_flow_meter";
    dokumenEfisiensi["uptime_ms"] = sekarang;
    String payloadEfisiensi;
    serializeJson(dokumenEfisiensi, payloadEfisiensi);
    publikasikanTeks(TOPIK_ANALYTICS_EFFICIENCY, payloadEfisiensi.c_str(), false);

    pompaMulaiMenyalaPada = 0;
  }

  statusPompa = menyala;
  if (RELAY_AKTIF_LOW) {
    digitalWrite(PIN_RELAY, menyala ? LOW : HIGH);
  } else {
    digitalWrite(PIN_RELAY, menyala ? HIGH : LOW);
  }
  Serial.print("[RELAY] Pompa: ");
  Serial.println(menyala ? "ON" : "OFF");
  kirimPerintahPompaArduino(menyala, "status_pompa_berubah");
}

void aturLampu(bool menyala) {
  statusLampu = menyala;
  digitalWrite(PIN_LAMPU, menyala ? HIGH : LOW);
  Serial.print("[LAMPU] ");
  Serial.println(menyala ? "ON" : "OFF");
  kirimPerintahLampuArduino(menyala, "status_lampu_berubah");
  kirimSinkronisasiStatusArduino("status_lampu_berubah");
}

// ======================================================
// LOG
// ======================================================
void cetakLogArduino() {
  Serial.println("=================================");
  Serial.println("===== DATA DARI ARDUINO =====");
  Serial.print("Perangkat  : "); Serial.println(nanoIdPerangkat);
  Serial.print("Suhu       : "); Serial.println(nanoSuhu, 1);
  Serial.print("Kelembapan : "); Serial.println(nanoKelembapanUdara, 1);
  Serial.print("Tanah      : "); Serial.println(nanoKelembapanTanah, 1);
  Serial.print("WiFi       : "); Serial.println(nanoStatusWifi);
  Serial.print("LED Nano   : "); Serial.println(statusLampuNano ? "ON" : "OFF");
  Serial.print("Relay Nano : "); Serial.println(statusRelayNano ? "ON" : "OFF");
  Serial.print("JSON Akhir : "); Serial.println(jsonArduinoTerakhir);
  Serial.println("=================================");
}

// ======================================================
// HEALTH, CUACA, DAN ANALYTICS
// ======================================================
int hitungSkorPenyiraman() {
  float soil = apakahNilaiTerbatas(nanoKelembapanTanah) ? nanoKelembapanTanah : 50.0f;
  float temp = apakahNilaiTerbatas(nanoSuhu) ? nanoSuhu : 28.0f;
  float humidity = apakahNilaiTerbatas(nanoKelembapanUdara) ? nanoKelembapanUdara : 70.0f;

  float skor = 0.0f;
  skor += constrain(70.0f - soil, 0.0f, 70.0f) * 1.15f;
  skor += constrain(temp - 28.0f, 0.0f, 12.0f) * 2.0f;
  skor += constrain(75.0f - humidity, 0.0f, 35.0f) * 0.45f;

  if (payloadCuacaBmkgTerakhir.indexOf("\"rain\"") >= 0 || payloadCuacaBmkgTerakhir.indexOf("hujan") >= 0) {
    skor -= 12.0f;
  }

  return constrain((int)roundf(skor), 0, 100);
}

void publikasikanRekomendasiAi(bool paksa) {
  if (!memilikiTelemetriArduino && !paksa) return;

  static unsigned long terakhirPublikasi = 0;
  static int skorTerakhir = -1;
  int skor = hitungSkorPenyiraman();
  unsigned long sekarang = millis();
  if (!paksa && skorTerakhir == skor && sekarang - terakhirPublikasi < 60000UL) return;

  int menit = constrain((int)roundf((float)skor / 12.0f), 1, 10);
  if (skor < 20) menit = 0;

  StaticJsonDocument<256> dokumen;
  dokumen["device_id"] = nanoIdPerangkat;
  dokumen["watering_score"] = skor;
  dokumen["recommendation"] = menit > 0 ? String(menit) + " menit" : "tidak perlu disiram";
  dokumen["soil"] = nanoKelembapanTanah;
  dokumen["temp"] = nanoSuhu;
  dokumen["humidity"] = nanoKelembapanUdara;
  dokumen["uptime_ms"] = sekarang;

  String payload;
  serializeJson(dokumen, payload);
  publikasikanTeks(TOPIK_AI_RECOMMENDATION, payload.c_str(), false);

  skorTerakhir = skor;
  terakhirPublikasi = sekarang;
}

void publikasikanFaultSensor(const char* device, const char* status) {
  StaticJsonDocument<160> dokumen;
  dokumen["device"] = device;
  dokumen["status"] = status;
  dokumen["uptime_ms"] = millis();
  String payload;
  serializeJson(dokumen, payload);
  publikasikanTeks(TOPIK_SYSTEM_FAULT, payload.c_str(), false);
}

void perbaruiStatusFaultSensor() {
  bool faultSekarang = !apakahNilaiTerbatas(nanoSuhu) || !apakahNilaiTerbatas(nanoKelembapanUdara) ||
                       nanoSuhu < -10.0f || nanoSuhu > 80.0f ||
                       nanoKelembapanUdara < 0.0f || nanoKelembapanUdara > 100.0f;

  if (faultSekarang != faultDhtAktif) {
    faultDhtAktif = faultSekarang;
    publikasikanFaultSensor("DHT11", faultDhtAktif ? "fault" : "ok");
  }
}

void perbaruiCacheBmkgDariJson(JsonVariantConst sumber) {
  if (sumber.isNull()) return;

  StaticJsonDocument<512> dokumen;
  dokumen["device_id"] = nanoIdPerangkat;
  dokumen["location"] = lokasiCuaca;
  dokumen["cached"] = false;
  dokumen["source"] = "bmkg";
  dokumen["uptime_ms"] = millis();

  if (!sumber["weather"].isNull()) {
    dokumen["data"] = sumber["weather"];
  } else if (!sumber["bmkg"].isNull()) {
    dokumen["data"] = sumber["bmkg"];
  } else {
    bool adaDataCuaca = false;
    JsonObject data = dokumen["data"].to<JsonObject>();
    if (!sumber["rain"].isNull()) {
      data["rain"] = sumber["rain"];
      adaDataCuaca = true;
    }
    if (!sumber["weather_condition"].isNull()) {
      data["condition"] = sumber["weather_condition"];
      adaDataCuaca = true;
    }
    if (!sumber["weather_desc"].isNull()) {
      data["description"] = sumber["weather_desc"];
      adaDataCuaca = true;
    }
    if (!adaDataCuaca) return;
  }

  payloadCuacaBmkgTerakhir = "";
  serializeJson(dokumen, payloadCuacaBmkgTerakhir);
  msCuacaBmkgTerakhir = millis();
  if (!sumber["rain"].isNull()) {
    float rainBaru = sumber["rain"].as<float>();
    if (apakahNilaiTerbatas(rainBaru)) {
      bmkgRainTerakhir = rainBaru;
      kirimSinkronisasiStatusArduino("cuaca_bmkg");
    }
  }
  cacheBmkgPernahDipublikasikan = false;
  publikasikanCuacaBmkg(true);
}

void publikasikanCuacaBmkg(bool paksa) {
  if (payloadCuacaBmkgTerakhir.length() == 0) return;
  unsigned long umur = millis() - msCuacaBmkgTerakhir;
  if (umur > BMKG_CACHE_VALID_MS) return;
  if (!paksa && cacheBmkgPernahDipublikasikan) return;

  StaticJsonDocument<768> dokumen;
  if (deserializeJson(dokumen, payloadCuacaBmkgTerakhir)) {
    publikasikanTeks(TOPIK_CUACA_DATA, payloadCuacaBmkgTerakhir.c_str(), false);
  } else {
    dokumen["cached"] = umur > 0;
    dokumen["cache_age_ms"] = umur;
    dokumen["cache_valid_ms"] = BMKG_CACHE_VALID_MS;
    String payload;
    serializeJson(dokumen, payload);
    publikasikanTeks(TOPIK_CUACA_DATA, payload.c_str(), false);
  }

  cacheBmkgPernahDipublikasikan = true;
}

void publikasikanHeartbeat() {
  StaticJsonDocument<192> dokumen;
  dokumen["heap"] = ESP.getFreeHeap();
  dokumen["wifi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  dokumen["uptime"] = millis();
  String payload;
  serializeJson(dokumen, payload);
  publikasikanMqtt(TOPIK_SYSTEM_HEARTBEAT, payload.c_str(), false, false);
}

void publikasikanResource(bool warningHeap) {
  StaticJsonDocument<256> dokumen;
  uint32_t heap = ESP.getFreeHeap();
  dokumen["device_id"] = nanoIdPerangkat;
  dokumen["heap"] = heap;
  dokumen["min_heap"] = ESP.getMinFreeHeap();
  dokumen["wifi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  dokumen["uptime"] = millis();
  dokumen["status"] = warningHeap ? "warning" : "ok";
  if (warningHeap) dokumen["warning"] = "heap_low";
  String payload;
  serializeJson(dokumen, payload);
  publikasikanTeks(TOPIK_SYSTEM_RESOURCE, payload.c_str(), false);
}

void prosesHeartbeatDanResource() {
  unsigned long sekarang = millis();

  if (sekarang - msTerakhirHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    msTerakhirHeartbeat = sekarang;
    publikasikanHeartbeat();
  }

  uint32_t heap = ESP.getFreeHeap();
  if (heap < HEAP_RESTART_BYTES) {
    publikasikanResource(true);
    delay(250);
    ESP.restart();
  }

  bool warningSekarang = heap < HEAP_WARNING_BYTES;
  if (warningSekarang != heapWarningAktif || sekarang - msTerakhirResource >= RESOURCE_INTERVAL_MS) {
    heapWarningAktif = warningSekarang;
    msTerakhirResource = sekarang;
    publikasikanResource(warningSekarang);
  }
}

// ======================================================
// SNAPSHOT MQTT & LOGIKA LAINNYA
// (Logika utama setelah perbaikan Baud Rate tetap sama)
// ======================================================
void publikasikanSnapshotSensor(bool paksa) {
  // [Kode fungsi ini tetap sesuai aslinya...]
  if (!memilikiTelemetriArduino) return;

  const bool suhuBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(nanoSuhu, suhuTerpublikasiTerakhir, 0.1f);
  const bool kelembapanUdaraBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(nanoKelembapanUdara, kelembapanUdaraTerpublikasiTerakhir, 0.5f);
  const bool kelembapanTanahBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(nanoKelembapanTanah, kelembapanTanahTerpublikasiTerakhir, 0.5f);
  const bool pompaBerubah = paksa || !telahMempublikasikanSnapshot || (statusPompa != statusPompaTerpublikasiTerakhir);
  const bool lampuBerubah = paksa || !telahMempublikasikanSnapshot || (statusLampu != statusLampuTerpublikasiTerakhir);
  const bool modeBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(modeOtomatis ? "auto" : "manual", modeTerpublikasiTerakhir);
  const bool wifiBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(nanoStatusWifi, statusWifiTerpublikasiTerakhir);
  const bool idPerangkatBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(nanoIdPerangkat, idPerangkatTerpublikasiTerakhir);
  const bool ambangKritisBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(nanoAmbangKritis, ambangKritisTerpublikasiTerakhir, 0.1f);
  const bool ambangAtasBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(nanoAmbangAtas, ambangAtasTerpublikasiTerakhir, 0.1f);
  const bool ambangBawahBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(nanoAmbangBawah, ambangBawahTerpublikasiTerakhir, 0.1f);
  const bool jadwalWaktuBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(jadwalPenyiramanWaktu, jadwalWaktuTerpublikasiTerakhir);
  const bool jadwalAktifBerubah = paksa || !telahMempublikasikanSnapshot || (jadwalPenyiramanAktif != jadwalAktifTerpublikasiTerakhir);
  const bool jadwalDurasiBerubah = paksa || !telahMempublikasikanSnapshot || nilaiIntBerubah(jadwalPenyiramanDurasi, jadwalDurasiTerpublikasiTerakhir);
  const bool formulaNamaBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(formulaNamaArduino, formulaNamaTerpublikasiTerakhir);
  const bool formulaSoilBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(formulaSoilArduino, formulaSoilTerpublikasiTerakhir);
  const bool formulaVpdBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(formulaVpdArduino, formulaVpdTerpublikasiTerakhir);
  const bool formulaScoreBerubah = paksa || !telahMempublikasikanSnapshot || nilaiStringBerubah(formulaScoreArduino, formulaScoreTerpublikasiTerakhir);
  const bool soilRawDryBerubah = paksa || !telahMempublikasikanSnapshot || nilaiFloatBerubah(soilRawDryArduino, soilRawDryTerpublikasiTerakhir, 0.5f);

  const bool adaPerubahan =
    suhuBerubah || kelembapanUdaraBerubah || kelembapanTanahBerubah ||
    pompaBerubah || lampuBerubah || modeBerubah || wifiBerubah || idPerangkatBerubah ||
    ambangKritisBerubah || ambangAtasBerubah || ambangBawahBerubah ||
    jadwalWaktuBerubah || jadwalAktifBerubah || jadwalDurasiBerubah ||
    formulaNamaBerubah || formulaSoilBerubah || formulaVpdBerubah || formulaScoreBerubah || soilRawDryBerubah;

  if (!adaPerubahan) return;

  if (kelembapanTanahBerubah) {
    char buffer[16];
    dtostrf(nanoKelembapanTanah, 1, 1, buffer);
    publikasikanTeks(TOPIK_KELEMBAPAN_TANAH, buffer, true);
  }
  if (suhuBerubah) {
    char buffer[16];
    dtostrf(nanoSuhu, 1, 1, buffer);
    publikasikanTeks(TOPIK_SUHU, buffer, true);
  }
  if (kelembapanUdaraBerubah) {
    char buffer[16];
    dtostrf(nanoKelembapanUdara, 1, 1, buffer);
    publikasikanTeks(TOPIK_KELEMBAPAN_UDARA, buffer, true);
  }

  if (pompaBerubah) publikasikanStatusPompa();
  if (lampuBerubah) publikasikanStatusLampu();
  if (modeBerubah) publikasikanStatusMode();
  if (wifiBerubah) publikasikanStatusWifi(nanoStatusWifi.c_str());
  if (jadwalWaktuBerubah || jadwalAktifBerubah || jadwalDurasiBerubah) publikasikanStatusJadwal();

  StaticJsonDocument<1024> dokumen;
  dokumen["device_id"] = nanoIdPerangkat;
  dokumen["temperature"] = nanoSuhu;
  dokumen["humidity"] = nanoKelembapanUdara;
  dokumen["soil_moisture"] = nanoKelembapanTanah;
  dokumen["pump_status"] = statusPompa;
  dokumen["led_status"] = statusLampu;
  dokumen["nano_led_status"] = statusLampuNano;
  dokumen["nano_relay_status"] = statusRelayNano;
  dokumen["device_mode"] = modeOtomatis ? "auto" : "manual";
  dokumen["wifi_status"] = nanoStatusWifi;
  dokumen["sensor_source"] = nanoSumberSensor;
  dokumen["threshold_kritis"] = nanoAmbangKritis;
  dokumen["threshold_atas"] = nanoAmbangAtas;
  dokumen["threshold_bawah"] = nanoAmbangBawah;
  dokumen["schedule_enabled"] = jadwalPenyiramanAktif;
  dokumen["watering_time"] = jadwalPenyiramanWaktu;
  dokumen["watering_duration"] = jadwalPenyiramanDurasi;
  dokumen["formula_name"] = formulaNamaArduino;
  dokumen["formula_soil"] = formulaSoilArduino;
  dokumen["formula_vpd"] = formulaVpdArduino;
  dokumen["formula_score"] = formulaScoreArduino;
  dokumen["soil_raw_dry"] = soilRawDryArduino;

  // Forward output kalkulasi dari Arduino (agar web/AI dapat angka yang sama)
  // Arduino kirimnya via serial pada fields: vpd, score_total(score), soil_score, vdp_score, rain_score, duration_estimate
  if (!isnan(dokumen["vpd"])) {} // no-op untuk appeasement (Arduino fields diteruskan di tanganiBarisArduino)
  // nilai-nilai ini belum ada variabel khusus, jadi kita ambil dari jsonArduinoTerakhir jika tersedia
  // (agar perubahan minim dan tidak butuh variabel global baru)
  {
    StaticJsonDocument<512> lastDoc;
    if (deserializeJson(lastDoc, jsonArduinoTerakhir)) {
      if (!lastDoc["vpd"].isNull()) dokumen["vpd"] = lastDoc["vpd"].as<float>();
      if (!lastDoc["score"].isNull()) dokumen["score_total"] = lastDoc["score"].as<float>();
      if (!lastDoc["soil_score"].isNull()) dokumen["soil_score"] = lastDoc["soil_score"].as<float>();
      if (!lastDoc["vdp_score"].isNull()) dokumen["vdp_score"] = lastDoc["vdp_score"].as<float>();
      if (!lastDoc["rain_score"].isNull()) dokumen["rain_score"] = lastDoc["rain_score"].as<float>();
      if (!lastDoc["duration_estimate"].isNull()) dokumen["duration_estimate"] = lastDoc["duration_estimate"].as<float>();
    }
  }

  dokumen["estimated_water_liter_total"] = totalLiterAirEstimasi;
  dokumen["offline_queue_pending"] = jumlahAntreanMqtt;

  dokumen["uptime_ms"] = millis();

  char payload[1024];
  size_t panjang = serializeJson(dokumen, payload, sizeof(payload));
  if (panjang > 0) {
    publikasikanMqtt(TOPIK_DATA_SENSOR_JSON, payload, true);
    publikasikanMqtt(TOPIK_HISTORY_UPLOAD, payload, false);
  }

  suhuTerpublikasiTerakhir = nanoSuhu;
  kelembapanUdaraTerpublikasiTerakhir = nanoKelembapanUdara;
  kelembapanTanahTerpublikasiTerakhir = nanoKelembapanTanah;
  statusPompaTerpublikasiTerakhir = statusPompa;
  statusLampuTerpublikasiTerakhir = statusLampu;
  modeTerpublikasiTerakhir = modeOtomatis ? "auto" : "manual";
  statusWifiTerpublikasiTerakhir = nanoStatusWifi;
  idPerangkatTerpublikasiTerakhir = nanoIdPerangkat;
  ambangKritisTerpublikasiTerakhir = nanoAmbangKritis;
  ambangAtasTerpublikasiTerakhir = nanoAmbangAtas;
  ambangBawahTerpublikasiTerakhir = nanoAmbangBawah;
  jadwalWaktuTerpublikasiTerakhir = jadwalPenyiramanWaktu;
  jadwalAktifTerpublikasiTerakhir = jadwalPenyiramanAktif;
  jadwalDurasiTerpublikasiTerakhir = jadwalPenyiramanDurasi;
  formulaNamaTerpublikasiTerakhir = formulaNamaArduino;
  formulaSoilTerpublikasiTerakhir = formulaSoilArduino;
  formulaVpdTerpublikasiTerakhir = formulaVpdArduino;
  formulaScoreTerpublikasiTerakhir = formulaScoreArduino;
  soilRawDryTerpublikasiTerakhir = soilRawDryArduino;
  telahMempublikasikanSnapshot = true;

  cetakLogArduino();
  publikasikanRekomendasiAi(paksa);
}

void muatWifiDariPreferensi() {
  preferensi.begin("nexagrow", true);
  String ssidTersimpan = preferensi.getString("wifi_ssid", "");
  String sandiTersimpan = preferensi.getString("wifi_pass", "");
  preferensi.end();

  if (ssidTersimpan.length() > 0) {
    ssidWifi = ssidTersimpan;
    kataSandiWifi = sandiTersimpan;
    Serial.println("[PREF] Kredensial WiFi yang tersimpan berhasil dimuat");
  } else {
    ssidWifi = SSID_WIFI_DEFAULT;
    kataSandiWifi = SANDI_WIFI_DEFAULT;
    Serial.println("[PREF] Menggunakan kredensial WiFi default");
  }
}

void simpanWifiKePreferensi(const String& ssid, const String& sandi) {
  preferensi.begin("nexagrow", false);
  preferensi.putString("wifi_ssid", ssid);
  preferensi.putString("wifi_pass", sandi);
  preferensi.end();
}

void hapusPreferensiWifi() {
  preferensi.begin("nexagrow", false);
  preferensi.remove("wifi_ssid");
  preferensi.remove("wifi_pass");
  preferensi.end();
}

void setStatusWifiTerkini(const char* status) {
  publikasikanStatusWifi(status);
}

bool cobaKoneksiWifiBlocking(const String& ssid, const String& sandi, unsigned long batasWaktuMs) {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(200);
  WiFi.begin(ssid.c_str(), sandi.c_str());
  unsigned long mulai = millis();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - mulai > batasWaktuMs) {
      Serial.println();
      return false;
    }
  }
  return true;
}

void mulaiPercobaanWifiAsync(const String& ssid, const String& sandi) {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(false, false);
  delay(50);
  WiFi.begin(ssid.c_str(), sandi.c_str());
  wifiSedangMenghubung = true;
  wifiMulaiPercobaanPada = millis();
  msTerakhirUpayaWifi = millis();
}

void pulihkanKredensialWifiDefault(const char* alasan) {
  ssidWifi = SSID_WIFI_DEFAULT;
  kataSandiWifi = SANDI_WIFI_DEFAULT;
  hapusPreferensiWifi();
  Serial.println("[WIFI] Kembali ke kredensial default");
  if (alasan && alasan[0] != '\0') {
    Serial.print("[WIFI] Alasan: ");
    Serial.println(alasan);
  }
}

void hubungkanWifiAwal() {
  Serial.println();
  Serial.println("=================================");
  Serial.println("HUBUNGKAN WIFI");
  Serial.println("=================================");
  Serial.print("[WIFI] Coba SSID: ");
  Serial.println(ssidWifi);

  bool terhubung = cobaKoneksiWifiBlocking(ssidWifi, kataSandiWifi, WIFI_CONNECT_TIMEOUT_MS);

  if (!terhubung) {
    Serial.println();
    Serial.println("[WIFI] Gagal terkoneksi dengan kredensial aktif");

    if (!(ssidWifi == SSID_WIFI_DEFAULT && kataSandiWifi == SANDI_WIFI_DEFAULT)) {
      pulihkanKredensialWifiDefault("kredensial_tersimpan_gagal");
      Serial.println("[WIFI] Mencoba ulang dengan kredensial default...");
      terhubung = cobaKoneksiWifiBlocking(ssidWifi, kataSandiWifi, WIFI_CONNECT_TIMEOUT_MS);
      wifiMenggunakanDefaultCadangan = terhubung;
    }
  } else {
    wifiMenggunakanDefaultCadangan = false;
  }

  if (!terhubung) {
    Serial.println();
    Serial.println("[WIFI] Gagal terkoneksi");
    publikasikanStatusWifi("TERPUTUS");
    wifiSedangMenghubung = false;
    return;
  }

  Serial.println();
  Serial.println("WiFi TERHUBUNG!");
  Serial.print("SSID: ");
  Serial.println(ssidWifi);
  Serial.print("Alamat IP: ");
  Serial.println(WiFi.localIP());

  wifiSedangMenghubung = false;
  wifiMulaiPercobaanPada = 0;

  if (wifiMenggunakanDefaultCadangan) {
    publikasikanStatusWifi("TERHUBUNG_DEFAULT");
    publikasikanStatusSistem("WIFI_CADANGAN_DEFAULT");
  } else {
    publikasikanStatusWifi("TERHUBUNG");
    publikasikanStatusSistem("WIFI_TERHUBUNG");
  }
}

void applyWifiCredentialsFromRequest(const String& ssid, const String& sandi) {
  if (ssid.length() < 1) {
    Serial.println("[WIFI] SSID kosong, abaikan");
    return;
  }
  Serial.println("[WIFI] Menguji kredensial baru...");
  bool berhasil = cobaKoneksiWifiBlocking(ssid, sandi, WIFI_CONNECT_TIMEOUT_MS);

  if (berhasil) {
    ssidWifi = ssid;
    kataSandiWifi = sandi;
    simpanWifiKePreferensi(ssid, sandi);

    Serial.println();
    Serial.println("[WIFI] Kredensial baru valid dan disimpan");
    publikasikanTeks(TOPIK_STATUS_WIFI, "{\"status\":\"tersimpan\",\"action\":\"restart\"}", true);
    delay(1200);
    ESP.restart();
    return;
  }

  Serial.println();
  Serial.println("[WIFI] Kredensial baru gagal, kembali ke default");
  pulihkanKredensialWifiDefault("kredensial_baru_gagal");

  bool defaultBerhasil = cobaKoneksiWifiBlocking(ssidWifi, kataSandiWifi, WIFI_CONNECT_TIMEOUT_MS);
  if (defaultBerhasil) {
    wifiMenggunakanDefaultCadangan = true;
    publikasikanTeks(TOPIK_STATUS_WIFI, "{\"status\":\"gagal\",\"fallback\":\"default\",\"result\":\"terhubung\"}", true);
    publikasikanStatusWifi("CADANGAN_DEFAULT");
    publikasikanStatusSistem("WIFI_CADANGAN_DEFAULT");
    publikasikanSnapshotSensor(true);
    return;
  }

  wifiMenggunakanDefaultCadangan = false;
  publikasikanTeks(TOPIK_STATUS_WIFI, "{\"status\":\"gagal\",\"fallback\":\"default\",\"result\":\"terputus\"}", true);
  publikasikanStatusWifi("TERPUTUS");
  publikasikanStatusSistem("WIFI_TERPUTUS");
}

void prosesWifi() {
  wl_status_t status = WiFi.status();
  unsigned long sekarang = millis();

  if (status == WL_CONNECTED) {
    wifiSedangMenghubung = false;
    wifiMulaiPercobaanPada = 0;

    if (!wifiStatusSudahDilaporkan) {
      wifiStatusSudahDilaporkan = true;
      if (wifiMenggunakanDefaultCadangan) {
        publikasikanStatusWifi("TERHUBUNG_DEFAULT");
        publikasikanStatusSistem("WIFI_CADANGAN_DEFAULT");
      } else {
        publikasikanStatusWifi("TERHUBUNG");
        publikasikanStatusSistem("WIFI_TERHUBUNG");
      }
      publikasikanSnapshotSensor(true);
    }
    return;
  }

  if (wifiStatusSudahDilaporkan) {
    wifiStatusSudahDilaporkan = false;
    publikasikanStatusWifi("TERPUTUS");
    publikasikanStatusSistem("WIFI_TERPUTUS");
  }

  if (wifiSedangMenghubung) {
    if (sekarang - wifiMulaiPercobaanPada >= WIFI_CONNECT_TIMEOUT_MS) {
      wifiSedangMenghubung = false;

      if (!wifiMenggunakanDefaultCadangan && !(ssidWifi == SSID_WIFI_DEFAULT && kataSandiWifi == SANDI_WIFI_DEFAULT)) {
        Serial.println("[WIFI] Percobaan kredensial tersimpan gagal, fallback ke default");
        pulihkanKredensialWifiDefault("timeout_kredensial_tersimpan");
        wifiMenggunakanDefaultCadangan = true;
        mulaiPercobaanWifiAsync(ssidWifi, kataSandiWifi);
        return;
      }
      Serial.println("[WIFI] Percobaan WiFi gagal");
      msTerakhirUpayaWifi = sekarang;
      publikasikanStatusWifi("TERPUTUS");
      publikasikanStatusSistem("WIFI_TERPUTUS");
    }
    return;
  }

  if (sekarang - msTerakhirUpayaWifi < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  Serial.println("[WIFI] Mencoba koneksi ulang...");
  mulaiPercobaanWifiAsync(ssidWifi, kataSandiWifi);
}

// ======================================================
// KONTROL OTOMATIS
// ======================================================
void terapkanKontrolOtomatis() {
  if (!modeOtomatis || !memilikiTelemetriArduino) return;

  // Untuk pompa: cukup soil yang valid. Suhu hanya dipakai untuk lampu.
  if (!apakahNilaiTerbatas(nanoKelembapanTanah)) return;

  // Gunakan ambang dinamis yang dikirim dari dashboard/Arduino.
  // nanoAmbangBawah/NanoAmbangAtas di-assign dari payload telemetry (threshold_bawah/threshold_atas).
  if (apakahNilaiTerbatas(nanoAmbangBawah) && nanoKelembapanTanah < nanoAmbangBawah && !statusPompa) {
    Serial.println("[OTOMATIS] Kelembapan tanah rendah (dynamic) -> Pompa MENYALA");
    aturPompa(true);
    publikasikanStatusPompa();
    publikasikanStatusSistem("POMPA_ON");
    publikasikanSnapshotSensor(true);
  } else if (apakahNilaiTerbatas(nanoAmbangAtas) && nanoKelembapanTanah > nanoAmbangAtas && statusPompa) {
    Serial.println("[OTOMATIS] Kelembapan tanah cukup (dynamic) -> Pompa MATI");
    aturPompa(false);
    publikasikanStatusPompa();
    publikasikanStatusSistem("POMPA_OFF");
    publikasikanSnapshotSensor(true);
  }

}



// ======================================================
// AI & MODE 
// ======================================================
void tanganiPerintahSettings(const String& pesan) {
  StaticJsonDocument<512> dokumen;
  if (deserializeJson(dokumen, pesan)) {
    Serial.println("[SETTINGS] JSON tidak valid");
    return;
  }

  bool adaPerubahan = false;

  if (dokumen.containsKey("plant_phase")) {
    String faseBaru = String(dokumen["plant_phase"] | faseTanaman.c_str());
    faseBaru.trim();
    if (faseBaru.length() == 0) faseBaru = faseTanaman;
    faseBaru.toLowerCase();
    if (faseBaru != "generatif") faseBaru = "vegetatif";
    if (faseBaru != faseTanaman) {
      faseTanaman = faseBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("location")) {
    String lokasiBaru = String(dokumen["location"] | lokasiCuaca.c_str());
    lokasiBaru.trim();
    if (lokasiBaru.length() > 0 && lokasiBaru != lokasiCuaca) {
      lokasiCuaca = lokasiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("auto_report")) {
    bool reportBaru = uraikanKolomBoolean(dokumen["auto_report"], autoReportAktif);
    if (reportBaru != autoReportAktif) {
      autoReportAktif = reportBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("report_time") && dokumen["report_time"].is<const char*>()) {
    String waktuBaru = dokumen["report_time"].as<const char*>();
    waktuBaru.trim();
    if (waktuBaru.length() > 0 && waktuBaru != waktuLaporanOtomatis) {
      waktuLaporanOtomatis = waktuBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("watering_time") && dokumen["watering_time"].is<const char*>()) {
    String waktuBaru = dokumen["watering_time"].as<const char*>();
    waktuBaru.trim();
    if (waktuBaru.length() > 0 && waktuBaru != jadwalPenyiramanWaktu) {
      jadwalPenyiramanWaktu = waktuBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("watering_duration")) {
    int durasiBaru = dokumen["watering_duration"] | jadwalPenyiramanDurasi;
    if (durasiBaru < 1) durasiBaru = 1;
    if (durasiBaru != jadwalPenyiramanDurasi) {
      jadwalPenyiramanDurasi = durasiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("watering_enabled")) {
    bool aktifBaru = uraikanKolomBoolean(dokumen["watering_enabled"], jadwalPenyiramanAktif);
    if (aktifBaru != jadwalPenyiramanAktif) {
      jadwalPenyiramanAktif = aktifBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("temp_threshold_low")) {
    float nilaiBaru = dokumen["temp_threshold_low"] | ambangSuhuBawah;
    if (nilaiBaru != ambangSuhuBawah) {
      ambangSuhuBawah = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("temp_threshold_high")) {
    float nilaiBaru = dokumen["temp_threshold_high"] | ambangSuhuAtas;
    if (nilaiBaru != ambangSuhuAtas) {
      ambangSuhuAtas = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("humidity_threshold_low")) {
    float nilaiBaru = dokumen["humidity_threshold_low"] | ambangKelembapanUdaraBawah;
    if (nilaiBaru != ambangKelembapanUdaraBawah) {
      ambangKelembapanUdaraBawah = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("humidity_threshold_high")) {
    float nilaiBaru = dokumen["humidity_threshold_high"] | ambangKelembapanUdaraAtas;
    if (nilaiBaru != ambangKelembapanUdaraAtas) {
      ambangKelembapanUdaraAtas = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("soil_threshold_critical")) {
    float nilaiBaru = dokumen["soil_threshold_critical"] | nanoAmbangKritis;
    if (nilaiBaru != nanoAmbangKritis) {
      nanoAmbangKritis = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("soil_threshold_high")) {
    float nilaiBaru = dokumen["soil_threshold_high"] | nanoAmbangAtas;
    if (nilaiBaru != nanoAmbangAtas) {
      nanoAmbangAtas = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("soil_threshold_low")) {
    float nilaiBaru = dokumen["soil_threshold_low"] | nanoAmbangBawah;
    if (nilaiBaru != nanoAmbangBawah) {
      nanoAmbangBawah = nilaiBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("user_name") && dokumen["user_name"].is<const char*>()) {
    String namaBaru = dokumen["user_name"].as<const char*>();
    namaBaru.trim();
    if (namaBaru.length() > 0 && namaBaru != namaPengguna) {
      namaPengguna = namaBaru;
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("user_email") && dokumen["user_email"].is<const char*>()) {
    String emailBaru = dokumen["user_email"].as<const char*>();
    emailBaru.trim();
    if (emailBaru.length() > 0 && emailBaru != emailPengguna) {
      emailPengguna = emailBaru;
      adaPerubahan = true;
    }
  }

  perbaruiCacheBmkgDariJson(dokumen.as<JsonVariantConst>());

  Serial.println("[SETTINGS] Perubahan diterima dari dashboard");
  Serial.print("  Fase: ");
  Serial.println(faseTanaman);
  Serial.print("  Lokasi: ");
  Serial.println(lokasiCuaca);
  Serial.print("  Suhu: ");
  Serial.print(ambangSuhuBawah);
  Serial.print(" - ");
  Serial.println(ambangSuhuAtas);
  Serial.print("  Kelembapan udara: ");
  Serial.print(ambangKelembapanUdaraBawah);
  Serial.print(" - ");
  Serial.println(ambangKelembapanUdaraAtas);
  Serial.print("  Kelembapan tanah: ");
  Serial.print(nanoAmbangBawah);
  Serial.print(" - ");
  Serial.println(nanoAmbangAtas);
  Serial.print("  Kritis tanah: ");
  Serial.println(nanoAmbangKritis);
  Serial.print("  Jadwal: ");
  Serial.print(jadwalPenyiramanWaktu);
  Serial.print(" / ");
  Serial.print(jadwalPenyiramanDurasi);
  Serial.println(" detik");

  if (adaPerubahan) {
    publikasikanStatusPengaturan("settings_cmd");
    publikasikanStatusJadwal();
    kirimSinkronisasiStatusArduino("settings_berubah");
    kirimSinkronisasiAmbangArduino("settings_berubah");
    publikasikanSnapshotSensor(true);
  }
}

void tanganiAksiAi(const String& pesan) {
  StaticJsonDocument<512> dokumen;
  DeserializationError kesalahan = deserializeJson(dokumen, pesan);

  if (kesalahan) {
    Serial.println("[AI] JSON TIDAK VALID");
    return;
  }

  String pompa = String(dokumen["pump"] | "");
  pompa.trim();
  pompa.toUpperCase();
  int durasi = dokumen["duration"] | 0;

  Serial.print("[AI] Pompa: ");
  Serial.println(pompa);
  Serial.print("[AI] Durasi: ");
  Serial.println(durasi);

  if (pompa == "ON") {
    aturPompa(true);
    publikasikanStatusPompa();
    publikasikanStatusSistem("POMPA_ON_DARI_AI");
    pompaMatiOtomatisAktif = durasi > 0;
    pompaMatiOtomatisPada = pompaMatiOtomatisAktif ? millis() + (unsigned long)durasi * 1000UL : 0;
    publikasikanSnapshotSensor(true);
  } else if (pompa == "OFF") {
    pompaMatiOtomatisAktif = false;
    pompaMatiOtomatisPada = 0;
    aturPompa(false);
    publikasikanStatusPompa();
    publikasikanStatusSistem("POMPA_OFF_DARI_AI");
    publikasikanSnapshotSensor(true);
  }
}

void tanganiPerintahMode(const String& pesan) {
  String normalisasi = pesan;
  normalisasi.trim();
  normalisasi.toUpperCase();

  if (normalisasi == "AUTO" || normalisasi == "MODE_AUTO" || normalisasi == "ON") {
    modeOtomatis = true;
  } else if (normalisasi == "MANUAL" || normalisasi == "MODE_MANUAL" || normalisasi == "OFF") {
    modeOtomatis = false;
  } else {
    Serial.println("[MODE] Perintah mode tidak dikenal");
    return;
  }

  publikasikanStatusMode();
  publikasikanStatusSistem(modeOtomatis ? "MODE_AUTO" : "MODE_MANUAL");
  kirimPerintahModeArduino(modeOtomatis, "perintah_mode");
  kirimSinkronisasiStatusArduino("mode_berubah");
  publikasikanSnapshotSensor(true);
}

void tanganiPerintahJadwal(const String& pesan) {
  StaticJsonDocument<256> dokumen;
  if (deserializeJson(dokumen, pesan)) {
    Serial.println("[JADWAL] JSON tidak valid");
    return;
  }

  if (dokumen.containsKey("schedule_enabled")) {
    jadwalPenyiramanAktif = uraikanKolomBoolean(dokumen["schedule_enabled"], jadwalPenyiramanAktif);
  }
  if (dokumen.containsKey("watering_time") && dokumen["watering_time"].is<const char*>()) {
    jadwalPenyiramanWaktu = dokumen["watering_time"].as<const char*>();
  }
  if (dokumen.containsKey("watering_duration")) {
    jadwalPenyiramanDurasi = dokumen["watering_duration"] | jadwalPenyiramanDurasi;
  }

  Serial.println("[JADWAL] Update jadwal diterima");
  Serial.print("  Waktu: ");
  Serial.println(jadwalPenyiramanWaktu);
  Serial.print("  Durasi: ");
  Serial.println(jadwalPenyiramanDurasi);
  Serial.print("  Aktif: ");
  Serial.println(jadwalPenyiramanAktif ? "YA" : "TIDAK");

  publikasikanStatusJadwal();
  publikasikanStatusPengaturan("schedule_cmd");
  kirimSinkronisasiStatusArduino("jadwal_diubah");
  publikasikanSnapshotSensor(true);
}

// ======================================================
// SERIAL ARDUINO LOGIC
// ======================================================
void tanganiBarisArduino(const String& baris) {
  String payload = ekstrakPayloadJson(baris);
  if (payload.length() < 2) return;

  StaticJsonDocument<384> dokumen;
  DeserializationError kesalahan = deserializeJson(dokumen, payload);

  if (kesalahan) {
    Serial.print("[ARDUINO] JSON tidak valid: ");
    Serial.println(kesalahan.c_str());
    return;
  }

  String jenisArduino = dokumen["type"] | "telemetry";
  String aksiArduino = dokumen["action"] | "";

  jsonArduinoTerakhir = payload;
  msTerakhirTerimaArduino = millis();

  if (jenisArduino == "ack") {
    Serial.println();
    Serial.print("[ARDUINO][ACK] ");
    Serial.println(aksiArduino);
    return;
  }

  memilikiTelemetriArduino = true;

  tetapkanStringJikaAda(nanoIdPerangkat, dokumen["device_id"]);
  tetapkanStringJikaAda(nanoSumberSensor, dokumen["sensor_source"]);
  tetapkanFloatJikaValid(nanoSuhu, dokumen["temperature"], dokumen["t"]);
  tetapkanFloatJikaValid(nanoKelembapanUdara, dokumen["humidity"], dokumen["h"]);
  tetapkanFloatJikaValid(nanoKelembapanTanah, dokumen["soil_moisture"], dokumen["s"]);
  tetapkanBooleanJikaValid(statusRelayNano, dokumen["relay_state"], dokumen["r"]);
  tetapkanBooleanJikaValid(statusLampuNano, dokumen["led_state"]);
  tetapkanBooleanJikaValid(modeOtomatisNano, dokumen["auto_mode"]);

  bool faseBerubah = false;
  if (dokumen["plant_phase"].is<const char*>()) {
    String faseBaru = dokumen["plant_phase"].as<const char*>();
    faseBaru.trim();
    faseBaru.toLowerCase();
    if (faseBaru != "generatif") faseBaru = "vegetatif";
    if (faseBaru != faseTanaman) {
      faseTanaman = faseBaru;
      faseBerubah = true;
    }
  } else if (dokumen["crop_mode"].is<const char*>()) {
    String faseBaru = dokumen["crop_mode"].as<const char*>();
    faseBaru.trim();
    faseBaru.toLowerCase();
    if (faseBaru != "generatif") faseBaru = "vegetatif";
    if (faseBaru != faseTanaman) {
      faseTanaman = faseBaru;
      faseBerubah = true;
    }
  }

  // Field hasil kalkulasi dari Arduino (untuk konsistensi AI/web)
  tetapkanFloatJikaValid(nanoKelembapanUdara, dokumen["temperature"], dokumen["t"]);
  if (!dokumen["m"].isNull()) {
    modeOtomatisNano = !uraikanKolomBoolean(dokumen["m"], !modeOtomatisNano);
  }
  tetapkanStringJikaAda(nanoStatusWifi, dokumen["wifi_status"]);

  // Sinkronkan status pompa-lampu dari Arduino ke state ESP32.
  // Penting: jangan mengubah modeOtomatis di sini agar kontrol mode (switch manual/auto) tidak "terkunci".
  if (apakahNilaiTerbatas(nanoKelembapanTanah) || statusRelayNano != statusPompaTerpublikasiTerakhir) {
    statusPompa = statusRelayNano;
    statusLampu = statusLampuNano;
  }


  tetapkanFloatJikaValid(nanoAmbangKritis, dokumen["threshold_kritis"]);
  tetapkanFloatJikaValid(nanoAmbangAtas, dokumen["threshold_atas"]);
  tetapkanFloatJikaValid(nanoAmbangBawah, dokumen["threshold_bawah"]);
  tetapkanBooleanJikaValid(jadwalPenyiramanAktif, dokumen["schedule_enabled"]);
  
  if (dokumen["watering_time"].is<const char*>()) jadwalPenyiramanWaktu = dokumen["watering_time"].as<const char*>();
  if (dokumen["watering_duration"].is<int>() || dokumen["watering_duration"].is<long>() || dokumen["watering_duration"].is<float>()) {
    jadwalPenyiramanDurasi = dokumen["watering_duration"] | jadwalPenyiramanDurasi;
  }
  
  tetapkanStringJikaAda(formulaNamaArduino, dokumen["formula_name"]);
  tetapkanStringJikaAda(formulaSoilArduino, dokumen["formula_soil"]);
  tetapkanStringJikaAda(formulaVpdArduino, dokumen["formula_vpd"]);
  tetapkanStringJikaAda(formulaScoreArduino, dokumen["formula_score"]);
  tetapkanFloatJikaValid(soilRawDryArduino, dokumen["soil_raw_dry"]);
  perbaruiCacheBmkgDariJson(dokumen.as<JsonVariantConst>());
  perbaruiStatusFaultSensor();

  if (faseBerubah) {
    publikasikanStatusPengaturan("arduino_phase_change");
  }

  if (!telahMengirimSinkronisasiAwalArduino) {
    kirimSinkronisasiStatusArduino("telemetri_pertama");
    telahMengirimSinkronisasiAwalArduino = true;
  }

  Serial.println();
  Serial.println("[ARDUINO] Data diterima");
  publikasikanSnapshotSensor(false);
}

void bacaDataArduino() {
  while (SerialArduino.available() > 0) {
    char karakter = (char)SerialArduino.read();
    if (karakter == '\r') continue;

    if (karakter == '\n') {
      penyanggaBarisArduino.trim();
      if (penyanggaBarisArduino.length() > 0) {
        tanganiBarisArduino(penyanggaBarisArduino);
      }
      penyanggaBarisArduino = "";
    } else {
      if (penyanggaBarisArduino.length() < 1024) {
        penyanggaBarisArduino += karakter;
      } else {
        penyanggaBarisArduino = "";
      }
    }
  }
}

void perbaruiAksiBerdasarkanWaktu() {
  if (pompaMatiOtomatisAktif && pompaMatiOtomatisPada > 0 && millis() >= pompaMatiOtomatisPada) {
    pompaMatiOtomatisAktif = false;
    pompaMatiOtomatisPada = 0;
    aturPompa(false);
    publikasikanStatusPompa();
    publikasikanStatusSistem("POMPA_OFF_SETELAH_AI");
    publikasikanSnapshotSensor(true);
  }
}

// ======================================================
// MQTT CALLBACK
// ======================================================
void panggilanBalik(char* topik, byte* payload, unsigned int panjang) {
  String pesan;
  for (unsigned int i = 0; i < panjang; i++) {
    pesan += (char)payload[i];
  }
  pesan.trim();
  pesan.toUpperCase();

  Serial.println();
  Serial.println("=================================");
  Serial.println("[PESAN MQTT]");
  Serial.print("Topik: ");
  Serial.println(topik);
  Serial.print("Pesan: ");
  Serial.println(pesan);
  Serial.println("=================================");

  String topikStr = String(topik);

  if (topikStr == TOPIK_PERINTAH_POMPA) {
    Serial.print("[MQTT] received pump command: ");
    Serial.println(pesan);

    if (pesan == "ON") {
      aturPompa(true);
      publikasikanStatusPompa();
      publikasikanStatusSistem("POMPA_ON");
      publikasikanSnapshotSensor(true);
    } else if (pesan == "OFF") {
      pompaMatiOtomatisAktif = false;
      pompaMatiOtomatisPada = 0;
      aturPompa(false);
      publikasikanStatusPompa();
      publikasikanStatusSistem("POMPA_OFF");
      publikasikanSnapshotSensor(true);
    } else {
      Serial.print("[MQTT] unknown pump command, ignoring: ");
      Serial.println(pesan);
    }
    return;
  }

  if (topikStr == TOPIK_PERINTAH_LAMPU) {
    if (pesan == "ON") {
      aturLampu(true);
      publikasikanStatusLampu();
      publikasikanStatusSistem("LAMPU_ON");
      publikasikanSnapshotSensor(true);
    } else if (pesan == "OFF") {
      aturLampu(false);
      publikasikanStatusLampu();
      publikasikanStatusSistem("LAMPU_OFF");
      publikasikanSnapshotSensor(true);
    }
    return;
  }

  if (topikStr == TOPIK_PERINTAH_MODE) {
    tanganiPerintahMode(pesan);
    return;
  }

  if (topikStr == TOPIK_PERINTAH_SETTINGS) {
    tanganiPerintahSettings(pesan);
    return;
  }

  if (topikStr == TOPIK_AKSI_AI) {
    tanganiAksiAi(pesan);
    return;
  }

  if (topikStr == TOPIK_PERINTAH_JADWAL) {
    tanganiPerintahJadwal(pesan);
    return;
  }

  if (topikStr == TOPIK_PERINTAH_WIFI) {
    StaticJsonDocument<256> dokumen;
    DeserializationError kesalahan = deserializeJson(dokumen, pesan);
    if (kesalahan) {
      Serial.println("[WIFI] JSON TIDAK VALID");
      return;
    }
    String ssidBaru = dokumen["ssid"] | "";
    String sandiBaru = dokumen["password"] | "";
    if (ssidBaru.length() == 0) {
      Serial.println("[WIFI] SSID kosong");
      return;
    }
    applyWifiCredentialsFromRequest(ssidBaru, sandiBaru);
    return;
  }
}

// ======================================================
// MQTT
// ======================================================
void kirimStatusMqttKeArduinoJikaBerubah(bool online) {
  static bool statusTerakhir = false;
  static bool pertama = true;
  if (!pertama && statusTerakhir == online) return;
  statusTerakhir = online;
  pertama = false;
  kirimStatusMqttArduino(online);
}

void pastikanKoneksiMqtt() {
  if (klien.connected()) return;
  if (millis() - msTerakhirUpayaKoneksiUlangMqtt < mqttRetryIntervalSekarangMs) return;
  msTerakhirUpayaKoneksiUlangMqtt = millis();

  if (WiFi.status() != WL_CONNECTED) return;

  Serial.println();
  Serial.println("[MQTT] Menghubungkan...");
  Serial.print("[MQTT] Backoff saat ini: ");
  Serial.print(mqttRetryIntervalSekarangMs / 1000UL);
  Serial.println(" detik");

  String idKlien = "ESP32SmartFarm-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  bool terhubung = klien.connect(
    idKlien.c_str(),
    pengguna_mqtt,
    sandi_mqtt,
    TOPIK_STATUS_ESP32,
    1,
    true,
    "OFFLINE"
  );

  if (!terhubung) {
    int statusKoneksi = klien.state();
    Serial.print("[MQTT] Gagal, kode status=");
    Serial.println(statusKoneksi);
    mqttRetryIntervalSekarangMs = min(mqttRetryIntervalSekarangMs * 2UL, MQTT_RETRY_INTERVAL_MAKS_MS);
    return;
  }

  Serial.println("[MQTT] Terhubung!");
  mqttRetryIntervalSekarangMs = MQTT_RETRY_INTERVAL_AWAL_MS;
  klien.subscribe(TOPIK_PERINTAH_POMPA, 1);
  klien.subscribe(TOPIK_PERINTAH_LAMPU, 1);
  klien.subscribe(TOPIK_PERINTAH_MODE, 1);
  klien.subscribe(TOPIK_PERINTAH_JADWAL, 1);
  klien.subscribe(TOPIK_PERINTAH_SETTINGS, 1);
  klien.subscribe(TOPIK_AKSI_AI, 1);
  klien.subscribe(TOPIK_PERINTAH_WIFI, 1);

  publikasikanStatusSistem("ONLINE");
  publikasikanTeks(TOPIK_STATUS_WEB, "ONLINE", true);
  publikasikanTeks(TOPIK_STATUS_ESP32, "ONLINE", true);
  publikasikanStatusWifi(WiFi.status() == WL_CONNECTED ? (wifiMenggunakanDefaultCadangan ? "TERHUBUNG_DEFAULT" : "CONNECTED") : "DISCONNECTED");
  publikasikanStatusMode();
  publikasikanStatusPompa();
  publikasikanStatusLampu();
  publikasikanStatusJadwal();
  publikasikanStatusPengaturan("mqtt_terhubung");
  kirimAntreanMqttTertunda();
  publikasikanCuacaBmkg(true);
  publikasikanRekomendasiAi(true);
  publikasikanSnapshotSensor(true);
  kirimSinkronisasiStatusArduino("mqtt_terhubung");
  kirimSinkronisasiAmbangArduino("mqtt_terhubung");
}

void cekPembaruanStatusMqtt() {
  bool mqttSekarang = klien.connected();
  if (mqttSekarang != statusMqttTerakhir) {
    statusMqttTerakhir = mqttSekarang;
    kirimStatusMqttArduino(mqttSekarang);
    if (!mqttSekarang) {
      publikasikanStatusSistem("MQTT_OFFLINE");
      publikasikanTeks(TOPIK_STATUS_WEB, "OFFLINE", true);
      publikasikanTeks(TOPIK_STATUS_ESP32, "OFFLINE", true);
    }
  }
}

// ======================================================
// SETUP & LOOP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  randomSeed(esp_random());

  Serial.println();
  Serial.println("=================================");
  Serial.println("NEXAGROW ESP32 MULAI");
  Serial.println("=================================");

  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_LAMPU, OUTPUT);

  statusPompa = false;
  statusLampu = false;
  digitalWrite(PIN_RELAY, RELAY_AKTIF_LOW ? HIGH : LOW);
  digitalWrite(PIN_LAMPU, LOW);

  SerialArduino.begin(BAUD_SERIAL_ARDUINO, SERIAL_8N1, PIN_RX_ARDUINO, PIN_TX_ARDUINO);
  SerialArduino.setTimeout(25);
  Serial.println("[ARDUINO] Serial2 siap pada 9600 baud");
  Serial.print("[ARDUINO] RX pin: "); Serial.print(PIN_RX_ARDUINO);
  Serial.print(" TX pin: "); Serial.println(PIN_TX_ARDUINO);
  delay(300);
  
  // Test send to Arduino
  Serial.println("[TEST] Mengirim test message ke Arduino...");
  delay(200);
  SerialArduino.print("{\"test\":true}\n");
  SerialArduino.flush();
  delay(200);
  
  kirimSinkronisasiStatusArduino("boot");
  kirimSinkronisasiAmbangArduino("boot");

  muatWifiDariPreferensi();
  hubungkanWifiAwal();

  klienEsp.setInsecure();
  klien.setServer(server_mqtt, port_mqtt);
  klien.setBufferSize(2048);
  klien.setCallback(panggilanBalik);

  pastikanKoneksiMqtt();
}

void loop() {
  bacaDataArduino();
  prosesWifi();
  pastikanKoneksiMqtt();
  cekPembaruanStatusMqtt();

  if (klien.connected()) {
    klien.loop();
    kirimAntreanMqttTertunda();
  }

  perbaruiAksiBerdasarkanWaktu();
  terapkanKontrolOtomatis();
  prosesHeartbeatDanResource();

  if (millis() - msTerakhirTerimaArduino > ARDUINO_TIMEOUT_MS) {
    Serial.println("[ARDUINO] Belum ada data baru dalam 15 detik");
    msTerakhirTerimaArduino = millis();
  }
}
