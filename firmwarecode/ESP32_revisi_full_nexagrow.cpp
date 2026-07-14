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
// Use the same hardware UART baud rate as the Arduino firmware.
const uint32_t BAUD_SERIAL_ARDUINO = 115200UL;

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
// Retry counter for serial telemetry requests
int arduinoTimeoutRetries = 0;
const int ARDUINO_TIMEOUT_RETRIES_MAX = 3;

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

static bool setJadwalPenyiramanWaktu(const char* waktuBaru) {
  if (!waktuBaru) return false;
  if (strlen(waktuBaru) != 5 || waktuBaru[2] != ':') return false;
  int jam = (waktuBaru[0] - '0') * 10 + (waktuBaru[1] - '0');
  int menit = (waktuBaru[3] - '0') * 10 + (waktuBaru[4] - '0');
  if (jam < 0 || jam > 23 || menit < 0 || menit > 59) return false;
  String normal = String(waktuBaru);
  if (normal == jadwalPenyiramanWaktu) return false;
  jadwalPenyiramanWaktu = normal;
  return true;
}

static bool setJadwalPenyiramanDurasi(int durasiBaru) {
  if (durasiBaru < 1) durasiBaru = 1;
  if (durasiBaru == jadwalPenyiramanDurasi) return false;
  jadwalPenyiramanDurasi = durasiBaru;
  return true;
}

static bool setJadwalPenyiramanAktif(bool aktifBaru) {
  if (aktifBaru == jadwalPenyiramanAktif) return false;
  jadwalPenyiramanAktif = aktifBaru;
  return true;
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

static String normalisasiJsonNonStandar(const String& pesan) {
  String hasil;
  hasil.reserve(pesan.length() + 16);
  bool diDalamString = false;
  bool karakterEscape = false;

  for (size_t i = 0; i < pesan.length(); ++i) {
    char c = pesan[i];

    if (karakterEscape) {
      hasil += c;
      karakterEscape = false;
      continue;
    }

    if (c == '\\') {
      hasil += c;
      karakterEscape = true;
      continue;
    }

    if (c == '"') {
      diDalamString = !diDalamString;
      hasil += c;
      continue;
    }

    if (!diDalamString) {
      if ((c == 'T' || c == 't') && i + 3 < pesan.length() &&
          (pesan[i + 1] == 'R' || pesan[i + 1] == 'r') &&
          (pesan[i + 2] == 'U' || pesan[i + 2] == 'u') &&
          (pesan[i + 3] == 'E' || pesan[i + 3] == 'e')) {
        hasil += "true";
        i += 3;
        continue;
      }

      if ((c == 'F' || c == 'f') && i + 4 < pesan.length() &&
          (pesan[i + 1] == 'A' || pesan[i + 1] == 'a') &&
          (pesan[i + 2] == 'L' || pesan[i + 2] == 'l') &&
          (pesan[i + 3] == 'S' || pesan[i + 3] == 's') &&
          (pesan[i + 4] == 'E' || pesan[i + 4] == 'e')) {
        hasil += "false";
        i += 4;
        continue;
      }
    }

    hasil += c;
  }

  return hasil;
}

void publikasikanSnapshotSensor(bool paksa = false);
void publikasikanRekomendasiAi(bool paksa = false);
void publikasikanCuacaBmkg(bool paksa = false);
void perbaruiStatusFaultSensor();
void prosesHeartbeatDanResource();
void kirimPermintaanTelemetriArduino(const char* alasan = nullptr);

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
  dokumen["watering_enabled"] = jadwalPenyiramanAktif;
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
  dokumen["schedule_enabled"] = jadwalPenyiramanAktif;
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
unsigned long msIgnoreScheduleTelemetryUntil = 0;

void kirimSinkronisasiStatusArduino(const char* alasan = nullptr) {
  StaticJsonDocument<384> dokumen;
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
  if (apakahNilaiTerbatas(bmkgRainTerakhir)) dokumen["rain"] = (int)roundf(bmkgRainTerakhir);

  msIgnoreScheduleTelemetryUntil = millis() + 1000;

  String payload;
  serializeJson(dokumen, payload);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);
  
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
  
  // Send to Arduino with a short retry so commands are not lost.
  msIgnoreScheduleTelemetryUntil = millis() + 3000;
  delay(10);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);
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

  msIgnoreScheduleTelemetryUntil = millis() + 3000;
  String payload;
  serializeJson(dokumen, payload);
  delay(10);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);
  Serial.print("[SERIAL->ARDUINO] set_lamp: ");
  Serial.println(menyala ? "ON" : "OFF");
}

void kirimPerintahModeArduino(bool otomatisAktif, const char* alasan = nullptr) {
  StaticJsonDocument<128> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "set_mode";
  dokumen["auto_mode"] = otomatisAktif;

  msIgnoreScheduleTelemetryUntil = millis() + 3000;
  String payload;
  serializeJson(dokumen, payload);
  delay(10);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);
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

  String payload;
  serializeJson(dokumen, payload);
  delay(10);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);
  Serial.println("[SERIAL->ARDUINO] sync_thresholds");
}

void kirimPermintaanTelemetriArduino(const char* alasan) {
  StaticJsonDocument<160> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "request_telemetry";
  dokumen["source"] = "esp32";

  String payload;
  serializeJson(dokumen, payload);
  delay(10);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);

  Serial.print("[SERIAL->ARDUINO] request_telemetry");
  if (alasan && alasan[0] != '\0') {
    Serial.print(" (");
    Serial.print(alasan);
    Serial.print(")");
  }
  Serial.println();
}

void kirimStatusMqttArduino(bool online) {
  StaticJsonDocument<128> dokumen;
  dokumen["type"] = "cmd";
  dokumen["action"] = "mqtt_status";
  dokumen["status"] = online;

  String payload;
  serializeJson(dokumen, payload);
  delay(10);
  SerialArduino.print(payload);
  SerialArduino.println();
  SerialArduino.flush();
  delay(20);
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
  // Also send a lightweight heartbeat to Arduino so it knows ESP32 is alive
  StaticJsonDocument<128> hb;
  hb["type"] = "heartbeat";
  hb["uptime"] = millis();
  hb["heap"] = ESP.getFreeHeap();
  String hbPayload;
  serializeJson(hb, hbPayload);
  SerialArduino.print(hbPayload);
  SerialArduino.println();
  SerialArduino.flush();
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
  // Hanya publikasi jika ada perubahan signifikan untuk menghemat bandwidth
  bool adaPerubahan = paksa || 
                      nilaiFloatBerubah(nanoSuhu, suhuTerpublikasiTerakhir) ||
                      nilaiFloatBerubah(nanoKelembapanUdara, kelembapanUdaraTerpublikasiTerakhir) ||
                      nilaiFloatBerubah(nanoKelembapanTanah, kelembapanTanahTerpublikasiTerakhir) ||
                      (statusPompa != statusPompaTerpublikasiTerakhir) ||
                      (modeOtomatis != (modeTerpublikasiTerakhir == "AUTO"));
                      
  if (!adaPerubahan) return;

  // Catat state publikasi terakhir
  suhuTerpublikasiTerakhir = nanoSuhu;
  kelembapanUdaraTerpublikasiTerakhir = nanoKelembapanUdara;
  kelembapanTanahTerpublikasiTerakhir = nanoKelembapanTanah;
  statusPompaTerpublikasiTerakhir = statusPompa;
  modeTerpublikasiTerakhir = modeOtomatis ? "AUTO" : "MANUAL";

  // Publikasi sub-topik terpisah (Untuk UI sederhana)
  publikasikanTeks(TOPIK_STATUS_POMPA, statusPompa ? "ON" : "OFF");
  publikasikanTeks(TOPIK_STATUS_MODE, modeOtomatis ? "AUTO" : "MANUAL");
  
  if (apakahNilaiTerbatas(nanoSuhu)) publikasikanTeks(TOPIK_SUHU, String(nanoSuhu, 1).c_str());
  if (apakahNilaiTerbatas(nanoKelembapanUdara)) publikasikanTeks(TOPIK_KELEMBAPAN_UDARA, String(nanoKelembapanUdara, 1).c_str());
  if (apakahNilaiTerbatas(nanoKelembapanTanah)) publikasikanTeks(TOPIK_KELEMBAPAN_TANAH, String(nanoKelembapanTanah, 1).c_str());

  // Publikasi JSON Lengkap ke MQTT
  DynamicJsonDocument doc(1024);
  doc["device_id"] = nanoIdPerangkat;
  doc["sensor_source"] = nanoSumberSensor;
  doc["temperature"] = nanoSuhu;
  doc["humidity"] = nanoKelembapanUdara;
  doc["soil_moisture"] = nanoKelembapanTanah;
  doc["relay_state"] = statusPompa;
  doc["auto_mode"] = modeOtomatis;
  doc["plant_phase"] = faseTanaman;
  doc["threshold_kritis"] = nanoAmbangKritis;
  doc["threshold_atas"] = nanoAmbangAtas;
  doc["threshold_bawah"] = nanoAmbangBawah;
  doc["watering_time"] = jadwalPenyiramanWaktu;
  doc["watering_duration"] = jadwalPenyiramanDurasi;
  doc["schedule_enabled"] = jadwalPenyiramanAktif;
  
  // Ekstrak Skor Kalkulasi Sistem Cerdas langsung dari Arduino
  DynamicJsonDocument ardDoc(1024);
  if (!deserializeJson(ardDoc, jsonArduinoTerakhir)) {
    if (ardDoc.containsKey("score")) doc["score_total"] = ardDoc["score"].as<float>();
    if (ardDoc.containsKey("soil_score")) doc["soil_score"] = ardDoc["soil_score"].as<float>();
    if (ardDoc.containsKey("vpd")) doc["vpd"] = ardDoc["vpd"].as<float>();
    if (ardDoc.containsKey("vdp_score")) doc["vdp_score"] = ardDoc["vdp_score"].as<float>();
    if (ardDoc.containsKey("rain_score")) doc["rain_score"] = ardDoc["rain_score"].as<float>();
    if (ardDoc.containsKey("duration_estimate")) doc["duration_estimate"] = ardDoc["duration_estimate"].as<float>();
    if (ardDoc.containsKey("watering_active")) doc["watering_active"] = ardDoc["watering_active"].as<bool>();
  }

  // Merakit JSON
  char payload[1024];
  serializeJson(doc, payload);
  
  // Kirimkan
  publikasikanMqtt(TOPIK_DATA_SENSOR_JSON, payload, true);
  
  telahMempublikasikanSnapshot = true;
  Serial.println("[MQTT] Snapshot sensor berhasil dikemas dan dipublikasikan.");
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

void muatJadwalDariPreferensi() {
  preferensi.begin("nexagrow", true);
  // Try short keys first (NVS key length limited). Fallback to legacy long keys if present.
  String waktuTersimpan = preferensi.getString("w_time", "");
  if (waktuTersimpan.length() == 0) {
    waktuTersimpan = preferensi.getString("watering_time", "");
  }
  int durasiTersimpan = preferensi.getInt("w_dur", jadwalPenyiramanDurasi);
  if (durasiTersimpan == jadwalPenyiramanDurasi) {
    // fallback to legacy key if short key absent
    durasiTersimpan = preferensi.getInt("watering_duration", jadwalPenyiramanDurasi);
  }
  bool aktifTersimpan = preferensi.getBool("sched", jadwalPenyiramanAktif);
  if (aktifTersimpan == jadwalPenyiramanAktif) {
    aktifTersimpan = preferensi.getBool("schedule_enabled", jadwalPenyiramanAktif);
  }
  // Detect legacy keys presence for possible migration
  String legacyWaktu = preferensi.getString("watering_time", "");
  int legacyDurasi = preferensi.getInt("watering_duration", -32768);
  bool legacyAktifPresent = preferensi.getBool("schedule_enabled", jadwalPenyiramanAktif);
  preferensi.end();

  if (waktuTersimpan.length() == 5 && waktuTersimpan[2] == ':') {
    int jam = (waktuTersimpan[0] - '0') * 10 + (waktuTersimpan[1] - '0');
    int menit = (waktuTersimpan[3] - '0') * 10 + (waktuTersimpan[4] - '0');
    if (jam >= 0 && jam < 24 && menit >= 0 && menit < 60) {
      jadwalPenyiramanWaktu = waktuTersimpan;
    }
  }

  if (durasiTersimpan > 0) {
    jadwalPenyiramanDurasi = durasiTersimpan;
  }

  jadwalPenyiramanAktif = aktifTersimpan;
  Serial.println("[PREF] Jadwal dari preferensi dimuat");

  // Automatic migration: if legacy keys exist and short keys are missing, migrate them.
  if ((legacyWaktu.length() > 0 || legacyDurasi != -32768) ) {
    preferensi.begin("nexagrow", false);
    bool migrated = false;
    if (legacyWaktu.length() > 0) {
      String cur = preferensi.getString("w_time", "");
      if (cur.length() == 0) {
        preferensi.putString("w_time", legacyWaktu);
        migrated = true;
      }
    }
    if (legacyDurasi != -32768) {
      int curd = preferensi.getInt("w_dur", jadwalPenyiramanDurasi);
      if (curd == jadwalPenyiramanDurasi) {
        preferensi.putInt("w_dur", legacyDurasi);
        migrated = true;
      }
    }
    // For boolean, check if short key absent by reading default and comparing
    bool curs = preferensi.getBool("sched", !jadwalPenyiramanAktif);
    if (curs == !jadwalPenyiramanAktif) {
      // no short key set — write from legacy
      preferensi.putBool("sched", legacyAktifPresent);
      migrated = true;
    }
    if (migrated) {
      Serial.println("[PREF] Legacy keys found — migrated to short keys.");
    }
    // Optionally remove legacy keys after successful migration to keep NVS clean
    if (migrated) {
      preferensi.remove("watering_time");
      preferensi.remove("watering_duration");
      preferensi.remove("schedule_enabled");
      Serial.println("[PREF] Legacy keys removed after migration.");
    }
    preferensi.end();
  }
}

void simpanJadwalKePreferensi() {
  preferensi.begin("nexagrow", false);
  // Store using short keys to avoid NVS KEY_TOO_LONG errors.
  preferensi.putString("w_time", jadwalPenyiramanWaktu);
  preferensi.putInt("w_dur", jadwalPenyiramanDurasi);
  preferensi.putBool("sched", jadwalPenyiramanAktif);
  preferensi.end();
  Serial.println("[PREF] Jadwal disimpan ke preferensi (short keys)");

  // Send a compact ACK to Arduino so it knows preferences were saved.
  StaticJsonDocument<128> ack;
  ack["type"] = "pref_ack";
  ack["action"] = "schedule_saved";
  ack["watering_time"] = jadwalPenyiramanWaktu;
  ack["watering_duration"] = jadwalPenyiramanDurasi;
  ack["schedule_enabled"] = jadwalPenyiramanAktif;
  delay(20);
  serializeJson(ack, SerialArduino);
  SerialArduino.println();
  SerialArduino.flush();
  delay(50);
  Serial.println("[SERIAL->ARDUINO] pref_ack sent");

  // Also publish ACK to MQTT / Web so dashboard can update quickly
  StaticJsonDocument<192> mqttAck;
  mqttAck["type"] = "pref_ack";
  mqttAck["action"] = "schedule_saved";
  mqttAck["device_id"] = nanoIdPerangkat;
  mqttAck["watering_time"] = jadwalPenyiramanWaktu;
  mqttAck["watering_duration"] = jadwalPenyiramanDurasi;
  mqttAck["schedule_enabled"] = jadwalPenyiramanAktif;
  mqttAck["source"] = "esp32";
  String mqttPayload;
  serializeJson(mqttAck, mqttPayload);
  publikasikanMqtt(TOPIK_STATUS_JADWAL, mqttPayload.c_str(), false, false);
}

void muatPengaturanDariPreferensi() {
  preferensi.begin("nexagrow", true);
  String fTersimpan = preferensi.getString("p_phase", "");
  if (fTersimpan.length() > 0) faseTanaman = fTersimpan;
  String locTersimpan = preferensi.getString("loc", "");
  if (locTersimpan.length() > 0) lokasiCuaca = locTersimpan;
  autoReportAktif = preferensi.getBool("a_rpt", autoReportAktif);
  String rtTersimpan = preferensi.getString("r_time", "");
  if (rtTersimpan.length() > 0) waktuLaporanOtomatis = rtTersimpan;
  ambangSuhuBawah = preferensi.getFloat("t_low", ambangSuhuBawah);
  ambangSuhuAtas = preferensi.getFloat("t_high", ambangSuhuAtas);
  ambangKelembapanUdaraBawah = preferensi.getFloat("h_low", ambangKelembapanUdaraBawah);
  ambangKelembapanUdaraAtas = preferensi.getFloat("h_high", ambangKelembapanUdaraAtas);
  nanoAmbangKritis = preferensi.getFloat("s_crit", nanoAmbangKritis);
  nanoAmbangBawah = preferensi.getFloat("s_low", nanoAmbangBawah);
  nanoAmbangAtas = preferensi.getFloat("s_high", nanoAmbangAtas);
  String uNameTersimpan = preferensi.getString("u_name", "");
  if (uNameTersimpan.length() > 0) namaPengguna = uNameTersimpan;
  String uEmailTersimpan = preferensi.getString("u_email", "");
  if (uEmailTersimpan.length() > 0) emailPengguna = uEmailTersimpan;
  preferensi.end();
  Serial.println("[PREF] Pengaturan dimuat dari preferensi");
}

void simpanPengaturanKePreferensi() {
  preferensi.begin("nexagrow", false);
  // short keys to avoid NVS key length limits
  preferensi.putString("p_phase", faseTanaman);
  preferensi.putString("loc", lokasiCuaca);
  preferensi.putBool("a_rpt", autoReportAktif);
  preferensi.putString("r_time", waktuLaporanOtomatis);
  preferensi.putString("w_time", jadwalPenyiramanWaktu);
  preferensi.putInt("w_dur", jadwalPenyiramanDurasi);
  preferensi.putBool("sched", jadwalPenyiramanAktif);
  preferensi.putFloat("t_low", ambangSuhuBawah);
  preferensi.putFloat("t_high", ambangSuhuAtas);
  preferensi.putFloat("h_low", ambangKelembapanUdaraBawah);
  preferensi.putFloat("h_high", ambangKelembapanUdaraAtas);
  preferensi.putFloat("s_crit", nanoAmbangKritis);
  preferensi.putFloat("s_low", nanoAmbangBawah);
  preferensi.putFloat("s_high", nanoAmbangAtas);
  preferensi.putString("u_name", namaPengguna);
  preferensi.putString("u_email", emailPengguna);
  preferensi.end();

  Serial.println("[PREF] Semua pengaturan disimpan ke preferensi (short keys)");

  // Send a COMPACT ACK to Arduino — only fields Arduino actually uses
  // Keep this small to fit within Arduino's 384-byte input buffer
  {
    StaticJsonDocument<192> ack;
    ack["type"] = "pref_ack";
    ack["action"] = "settings_saved";
    ack["watering_time"] = jadwalPenyiramanWaktu;
    ack["watering_duration"] = jadwalPenyiramanDurasi;
    ack["schedule_enabled"] = jadwalPenyiramanAktif;
    ack["plant_phase"] = faseTanaman;
    ack["threshold_kritis"] = nanoAmbangKritis;
    ack["threshold_atas"] = nanoAmbangAtas;
    ack["threshold_bawah"] = nanoAmbangBawah;

    delay(20);
    serializeJson(ack, SerialArduino);
    SerialArduino.println();
    SerialArduino.flush();
    delay(50);
    Serial.println("[SERIAL->ARDUINO] pref_ack (settings_saved) sent");
  }

  // Full ACK to MQTT / Web dashboard (can be larger)
  StaticJsonDocument<384> mqttAck;
  mqttAck["type"] = "pref_ack";
  mqttAck["action"] = "settings_saved";
  mqttAck["device_id"] = nanoIdPerangkat;
  mqttAck["watering_time"] = jadwalPenyiramanWaktu;
  mqttAck["watering_duration"] = jadwalPenyiramanDurasi;
  mqttAck["schedule_enabled"] = jadwalPenyiramanAktif;
  mqttAck["plant_phase"] = faseTanaman;
  mqttAck["location"] = lokasiCuaca;
  mqttAck["auto_report"] = autoReportAktif;
  mqttAck["report_time"] = waktuLaporanOtomatis;
  mqttAck["user_name"] = namaPengguna;
  mqttAck["user_email"] = emailPengguna;
  mqttAck["source"] = "esp32";
  String mqttPayload2;
  serializeJson(mqttAck, mqttPayload2);
  publikasikanMqtt(TOPIK_STATUS_SETTINGS, mqttPayload2.c_str(), false, false);
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
  
  static unsigned long lastAutoOn = 0;
  // Cooldown 60 detik untuk mencegah race condition (toggling cepat) dengan Arduino
  if (millis() - lastAutoOn < 60000) return;

  if (apakahNilaiTerbatas(nanoAmbangBawah) && nanoKelembapanTanah < nanoAmbangBawah && !statusPompa) {
    Serial.println("[OTOMATIS] Kelembapan tanah rendah (dynamic) -> Pompa MENYALA");
    aturPompa(true);
    publikasikanStatusPompa();
    publikasikanStatusSistem("POMPA_ON");
    publikasikanSnapshotSensor(true);
    lastAutoOn = millis();
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
  DynamicJsonDocument dokumenMentah(1024);
  DynamicJsonDocument dokumen(1024);
  String payloadJson = normalisasiJsonNonStandar(pesan);
  Serial.println("[WEB->ESP32] settings payload received");
  Serial.println(payloadJson);
  DeserializationError kesalahan = deserializeJson(dokumenMentah, payloadJson);
  if (kesalahan) {
    Serial.println("[SETTINGS] JSON tidak valid");
    return;
  }

  dokumen.clear();
  JsonObject normal = dokumen.to<JsonObject>();
  for (JsonPairConst pasangan : dokumenMentah.as<JsonObjectConst>()) {
    String namaKunci = String(pasangan.key().c_str());
    namaKunci.toLowerCase();

    if (namaKunci == "plant_phase" || namaKunci == "pp") {
      if (namaKunci == "pp") {
        int nilai = pasangan.value().as<int>();
        normal["plant_phase"] = (nilai == 1 ? "generatif" : "vegetatif");
      } else {
        normal["plant_phase"] = pasangan.value();
      }
    } else if (namaKunci == "location" || namaKunci == "weather_location") {
      normal["location"] = pasangan.value();
    } else if (namaKunci == "weather_condition") {
      normal["weather_condition"] = pasangan.value();
    } else if (namaKunci == "weather_rain_chance" || namaKunci == "rain" || namaKunci == "rc") {
      normal["rain"] = pasangan.value();
    } else if (namaKunci == "weather_temperature") {
      normal["weather_temperature"] = pasangan.value();
    } else if (namaKunci == "temp_threshold_low") {
      normal["temp_threshold_low"] = pasangan.value();
    } else if (namaKunci == "temp_threshold_high") {
      normal["temp_threshold_high"] = pasangan.value();
    } else if (namaKunci == "humidity_threshold_low") {
      normal["humidity_threshold_low"] = pasangan.value();
    } else if (namaKunci == "humidity_threshold_high") {
      normal["humidity_threshold_high"] = pasangan.value();
    } else if (namaKunci == "soil_threshold_low") {
      normal["soil_threshold_low"] = pasangan.value();
    } else if (namaKunci == "soil_threshold_high") {
      normal["soil_threshold_high"] = pasangan.value();
    } else if (namaKunci == "soil_threshold_critical" || namaKunci == "tk") {
      normal["soil_threshold_critical"] = pasangan.value();
    } else if (namaKunci == "watering_time" || namaKunci == "wt") {
      normal["watering_time"] = pasangan.value();
    } else if (namaKunci == "watering_duration" || namaKunci == "wd") {
      normal["watering_duration"] = pasangan.value();
    } else if (namaKunci == "watering_enabled" || namaKunci == "schedule_enabled" || namaKunci == "se") {
      normal["watering_enabled"] = pasangan.value();
    } else if (namaKunci == "auto_mode" || namaKunci == "am") {
      normal["auto_mode"] = pasangan.value();
    } else if (namaKunci == "auto_report") {
      normal["auto_report"] = pasangan.value();
    } else if (namaKunci == "report_time") {
      normal["report_time"] = pasangan.value();
    } else if (namaKunci == "user_name") {
      normal["user_name"] = pasangan.value();
    } else if (namaKunci == "user_email") {
      normal["user_email"] = pasangan.value();
    } else {
      normal[namaKunci.c_str()] = pasangan.value();
    }
  }

  bool adaPerubahan = false;

  if (dokumen.containsKey("plant_phase")) {
    String faseBaru = String(dokumen["plant_phase"] | faseTanaman.c_str());
    faseBaru.trim();
    if (faseBaru.length() == 0) faseBaru = faseTanaman;
    faseBaru.toLowerCase();
    if (faseBaru == "generatif" || faseBaru == "generative" || faseBaru == "gen") faseBaru = "generatif";
    else faseBaru = "vegetatif";
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
      if (setJadwalPenyiramanWaktu(waktuBaru.c_str())) {
        adaPerubahan = true;
      }
    }
  }

  if (dokumen.containsKey("watering_duration")) {
    int durasiBaru = dokumen["watering_duration"] | jadwalPenyiramanDurasi;
    if (setJadwalPenyiramanDurasi(durasiBaru)) {
      adaPerubahan = true;
    }
  }

  if (dokumen.containsKey("watering_enabled")) {
    bool aktifBaru = uraikanKolomBoolean(dokumen["watering_enabled"], jadwalPenyiramanAktif);
    if (setJadwalPenyiramanAktif(aktifBaru)) {
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

  if (adaPerubahan) {
    // Persist all changed settings and notify Arduino + MQTT
    simpanPengaturanKePreferensi();
  } else {
    Serial.println("[SETTINGS] Tidak ada perubahan, mengirim ACK settings_saved");
    StaticJsonDocument<256> mqttAck;
    mqttAck["type"] = "pref_ack";
    mqttAck["action"] = "settings_saved";
    mqttAck["device_id"] = nanoIdPerangkat;
    mqttAck["watering_time"] = jadwalPenyiramanWaktu;
    mqttAck["watering_duration"] = jadwalPenyiramanDurasi;
    mqttAck["schedule_enabled"] = jadwalPenyiramanAktif;
    mqttAck["plant_phase"] = faseTanaman;
    mqttAck["location"] = lokasiCuaca;
    mqttAck["source"] = "esp32";
    String ackPayload;
    serializeJson(mqttAck, ackPayload);
    publikasikanMqtt(TOPIK_STATUS_SETTINGS, ackPayload.c_str(), false, false);
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
  Serial.println("[WEB->ESP32] schedule payload received");
  Serial.println(pesan);
  if (deserializeJson(dokumen, pesan)) {
    Serial.println("[JADWAL] JSON tidak valid");
    return;
  }

  bool jadwalBerubah = false;
  if (dokumen.containsKey("schedule_enabled") || dokumen.containsKey("watering_enabled") || dokumen.containsKey("se")) {
    bool aktifBaru = jadwalPenyiramanAktif;
    if (dokumen.containsKey("schedule_enabled")) {
      aktifBaru = uraikanKolomBoolean(dokumen["schedule_enabled"], jadwalPenyiramanAktif);
    } else if (dokumen.containsKey("watering_enabled")) {
      aktifBaru = uraikanKolomBoolean(dokumen["watering_enabled"], jadwalPenyiramanAktif);
    } else {
      aktifBaru = uraikanKolomBoolean(dokumen["se"], jadwalPenyiramanAktif);
    }
    if (setJadwalPenyiramanAktif(aktifBaru)) {
      jadwalBerubah = true;
    }
  }
  if (dokumen.containsKey("watering_time") || dokumen.containsKey("wt")) {
    const char* waktuBaru = nullptr;
    if (dokumen.containsKey("watering_time") && dokumen["watering_time"].is<const char*>()) {
      waktuBaru = dokumen["watering_time"].as<const char*>();
    } else if (dokumen.containsKey("wt") && dokumen["wt"].is<const char*>()) {
      waktuBaru = dokumen["wt"].as<const char*>();
    }
    if (waktuBaru && waktuBaru[0] != '\0' && setJadwalPenyiramanWaktu(waktuBaru)) {
      jadwalBerubah = true;
    }
  }
  if (dokumen.containsKey("watering_duration") || dokumen.containsKey("wd")) {
    int durasiBaru = jadwalPenyiramanDurasi;
    if (dokumen.containsKey("watering_duration")) {
      durasiBaru = dokumen["watering_duration"] | jadwalPenyiramanDurasi;
    } else {
      durasiBaru = dokumen["wd"] | jadwalPenyiramanDurasi;
    }
    if (setJadwalPenyiramanDurasi(durasiBaru)) {
      jadwalBerubah = true;
    }
  }

  if (jadwalBerubah) {
    simpanJadwalKePreferensi();
  } else {
    Serial.println("[JADWAL] Tidak ada perubahan, mengirim ACK schedule_saved");
    StaticJsonDocument<128> mqttAck;
    mqttAck["type"] = "pref_ack";
    mqttAck["action"] = "schedule_saved";
    mqttAck["device_id"] = nanoIdPerangkat;
    mqttAck["watering_time"] = jadwalPenyiramanWaktu;
    mqttAck["watering_duration"] = jadwalPenyiramanDurasi;
    mqttAck["schedule_enabled"] = jadwalPenyiramanAktif;
    mqttAck["source"] = "esp32";
    String ackPayload;
    serializeJson(mqttAck, ackPayload);
    publikasikanMqtt(TOPIK_STATUS_JADWAL, ackPayload.c_str(), false, false);
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
// ======================================================
// PARSING DATA DARI ARDUINO
// ======================================================
void tanganiBarisArduino(const String& baris) {
  String jsonString = ekstrakPayloadJson(baris);
  if (jsonString.length() == 0) return;

  DynamicJsonDocument dokumen(1024);
  DeserializationError kesalahan = deserializeJson(dokumen, jsonString);

  if (kesalahan) {
    Serial.print("[ESP32] Gagal parsing JSON dari Arduino: ");
    Serial.println(kesalahan.c_str());
    return;
  }

  String tipe = dokumen["type"] | "";

  if (tipe == "telemetry") {
    memilikiTelemetriArduino = true;
    msTerakhirTerimaArduino = millis();
    jsonArduinoTerakhir = jsonString; // Simpan JSON mentah untuk keperluan analitik 

    // 1. Identifikasi Perangkat
    if (dokumen.containsKey("device_id")) nanoIdPerangkat = dokumen["device_id"].as<String>();
    if (dokumen.containsKey("sensor_source")) nanoSumberSensor = dokumen["sensor_source"].as<String>();

    // 2. Data Sensor Lingkungan
    tetapkanFloatJikaValid(nanoSuhu, dokumen["temperature"]);
    tetapkanFloatJikaValid(nanoKelembapanUdara, dokumen["humidity"]);
    tetapkanFloatJikaValid(nanoKelembapanTanah, dokumen["soil_moisture"]);

    // 3. Status Relay & Mode Otomatis
    tetapkanBooleanJikaValid(statusRelayNano, dokumen["relay_state"]);
    tetapkanBooleanJikaValid(statusLampuNano, dokumen["led_state"]);
    tetapkanBooleanJikaValid(modeOtomatisNano, dokumen["auto_mode"]);
    
    // Sinkronisasi state internal ESP32
    statusPompa = statusRelayNano;
    modeOtomatis = modeOtomatisNano;

    // 4. Parameter & Ambang Batas (Threshold)
    if (dokumen.containsKey("plant_phase")) {
      String fase = dokumen["plant_phase"].as<String>();
      fase.toLowerCase();
      fase.trim();
      faseTanaman = (fase == "generatif" || fase == "generative" || fase == "gen") ? "generatif" : "vegetatif";
    }

    tetapkanFloatJikaValid(nanoAmbangKritis, dokumen["threshold_kritis"]);
    tetapkanFloatJikaValid(nanoAmbangAtas, dokumen["threshold_atas"]);
    tetapkanFloatJikaValid(nanoAmbangBawah, dokumen["threshold_bawah"]);

    // 5. Jadwal Penyiraman
    if (dokumen.containsKey("watering_time")) {
      String waktu = dokumen["watering_time"].as<String>();
      if (waktu.length() == 5) jadwalPenyiramanWaktu = waktu;
    }
    if (dokumen.containsKey("watering_duration")) {
      jadwalPenyiramanDurasi = dokumen["watering_duration"].as<int>();
    }
    tetapkanBooleanJikaValid(jadwalPenyiramanAktif, dokumen["schedule_enabled"]);

    // 6. Terbitkan Data ke Web/MQTT setelah memori di-update
    publikasikanSnapshotSensor(false);
  }
  else if (tipe == "ack") {
    String aksi = dokumen["action"] | "";
    Serial.print("[ESP32] Terima ACK dari Arduino untuk aksi: ");
    Serial.println(aksi);
  }
  else if (tipe == "pref_ack_resp") {
    Serial.println("[ESP32] Sinkronisasi Pengaturan (Preferences) ke Arduino Berhasil.");
  }
  else if (tipe == "sync_ack") {
    Serial.println("[ESP32] Sinkronisasi Status Cuaca & Ambang Batas Berhasil.");
  }
}
void bacaDataArduino() {
  // Read all available bytes into the buffer first
  while (SerialArduino.available() > 0) {
    char k = (char)SerialArduino.read();
    if (k == '\r') continue;
    if (k != '\n' && (k < 32 || k > 126)) continue;

    // append up to a safety limit
    if (penyanggaBarisArduino.length() < 4096) {
      penyanggaBarisArduino += k;
    } else {
      // buffer runaway: drop and reset
      Serial.println("[ARDUINO] Buffer overflow, discarding partial data");
      penyanggaBarisArduino = "";
    }
  }

  int start = penyanggaBarisArduino.indexOf('{');
  if (start < 0 && penyanggaBarisArduino.length() > 128) {
    Serial.println("[ARDUINO] No '{' found and buffer grew too large — clearing early");
    penyanggaBarisArduino = "";
  }

  // Try to extract complete JSON objects from the buffer using brace matching.
  while (true) {
    int start = penyanggaBarisArduino.indexOf('{');
    if (start < 0) {
      // no JSON start yet; if buffer grows too large, clear it
      if (penyanggaBarisArduino.length() > 2048) {
        Serial.println("[ARDUINO] No '{' found and buffer too large — clearing");
        penyanggaBarisArduino = "";
      }
      break;
    }

    // iterate to find matching closing brace while respecting strings and escapes
    int braceCount = 0;
    bool inString = false;
    bool escape = false;
    int end = -1;
    for (int i = start; i < (int)penyanggaBarisArduino.length(); ++i) {
      char c = penyanggaBarisArduino[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c == '\\') {
        if (inString) escape = true;
        continue;
      }
      if (c == '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (c == '{') {
          braceCount++;
        } else if (c == '}') {
          braceCount--;
          if (braceCount == 0) {
            end = i;
            break;
          }
        }
      }
    }

    if (end < 0) {
      // incomplete JSON frame — wait for more data
      // but protect against extremely large partials
      if (penyanggaBarisArduino.length() > 4096) {
        Serial.println("[ARDUINO] Incomplete JSON too large — discarding");
        penyanggaBarisArduino = "";
      }
      break;
    }

    // Extract full JSON frame and process it
    String frame = penyanggaBarisArduino.substring(start, end + 1);
    frame.trim();
    if (frame.length() > 0) {
      Serial.print("[RAW->ESP32] ");
      Serial.println(frame);
      tanganiBarisArduino(frame);
    }

    // Remove processed fragment from buffer
    if (end + 1 >= (int)penyanggaBarisArduino.length()) {
      penyanggaBarisArduino = "";
    } else {
      penyanggaBarisArduino = penyanggaBarisArduino.substring(end + 1);
    }
    // continue loop to find more frames
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
  String rawPesan;
  for (unsigned int i = 0; i < panjang; i++) {
    rawPesan += (char)payload[i];
  }
  rawPesan.trim();

  String pesan = rawPesan;
  bool isJson = pesan.startsWith("{") || pesan.startsWith("[");
  if (!isJson) {
    pesan.toUpperCase();
  }

  Serial.println();
  Serial.println("=================================");
  Serial.println("[PESAN MQTT]");
  Serial.print("Topik: ");
  Serial.println(topik);
  Serial.print("Pesan: ");
  Serial.println(rawPesan);
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
    tanganiPerintahSettings(rawPesan);
    return;
  }

  if (topikStr == TOPIK_AKSI_AI) {
    tanganiAksiAi(rawPesan);
    return;
  }

  if (topikStr == TOPIK_PERINTAH_JADWAL) {
    tanganiPerintahJadwal(rawPesan);
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

  SerialArduino.setRxBufferSize(2048);
  SerialArduino.begin(BAUD_SERIAL_ARDUINO, SERIAL_8N1, PIN_RX_ARDUINO, PIN_TX_ARDUINO);
  SerialArduino.setTimeout(25);
  Serial.print("[ARDUINO] Serial2 siap pada "); Serial.print(BAUD_SERIAL_ARDUINO);
  Serial.println(" baud");
  Serial.print("[ARDUINO] RX pin: "); Serial.print(PIN_RX_ARDUINO);
  Serial.print(" TX pin: "); Serial.println(PIN_TX_ARDUINO);
  delay(300);
  
  // Test send to Arduino
  Serial.println("[TEST] Mengirim test message ke Arduino...");
  delay(200);
  SerialArduino.print("{\"test\":true}\n");
  SerialArduino.flush();
  delay(200);

  // Do not overwrite Arduino EEPROM state on boot with default schedule/thresholds.
  // Arduino will sync with ESP32 after the first valid telemetry arrives.
  muatPengaturanDariPreferensi();
  muatJadwalDariPreferensi();
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
    arduinoTimeoutRetries++;

    if (arduinoTimeoutRetries <= ARDUINO_TIMEOUT_RETRIES_MAX) {
      // Normal retry: ask for telemetry
      char alasanBuf[64];
      snprintf(alasanBuf, sizeof(alasanBuf), "timeout_retry_%d", arduinoTimeoutRetries);
      kirimPermintaanTelemetriArduino(alasanBuf);
      msTerakhirTerimaArduino = millis();
    } else {
      // Recovery: try reinitializing the Serial interface and request telemetry
      Serial.println("[ARDUINO] Percobaan pemulihan komunikasi: reinit SerialArduino");
      SerialArduino.end();
      delay(150);
      SerialArduino.setRxBufferSize(2048);
      SerialArduino.begin(BAUD_SERIAL_ARDUINO, SERIAL_8N1, PIN_RX_ARDUINO, PIN_TX_ARDUINO);
      SerialArduino.setTimeout(25);
      delay(200);
      kirimPermintaanTelemetriArduino("timeout_recover");
      // reset counter and timer after recovery attempt
      arduinoTimeoutRetries = 0;
      msTerakhirTerimaArduino = millis();
    }
  }

  // Update indikator LED internal (berkedip jika ada error/putus)
  bool adaError = false;
  if (millis() - msTerakhirTerimaArduino > ARDUINO_TIMEOUT_MS) adaError = true;
  if (!apakahNilaiTerbatas(nanoSuhu) || nanoSuhu <= 0) adaError = true;
  if (!apakahNilaiTerbatas(nanoKelembapanTanah)) adaError = true;

  if (adaError) {
    if ((millis() / 500) % 2 == 0) {
      digitalWrite(PIN_LAMPU, HIGH);
    } else {
      digitalWrite(PIN_LAMPU, LOW);
    }
  } else {
    digitalWrite(PIN_LAMPU, statusLampu ? HIGH : LOW);
  }
}
