// ==========================================
// LIBRARY
// ==========================================
#include <DHT.h>
#include <EEPROM.h>
#include <RTClib.h>

RTC_DS3231 rtc;

// ==========================================
// PENGATURAN SERIAL & KOMUNIKASI (ESP32 BRIDGE)
// ==========================================
// Menggunakan hardware UART native Nano pada pin D0/D1 untuk koneksi ESP32.
// Menghindari isu korupsi data SoftwareSerial untuk koneksi real-time yang stabil.
// Koneksi: ESP32 TX -> Arduino RX (D0) | ESP32 RX -> Arduino TX (D1).
#define SerialPrint(...)   Serial.print(__VA_ARGS__)
#define SerialPrintln(...) Serial.println(__VA_ARGS__)
#define SerialFlush()      Serial.flush()
#define ESP32_BAUD         115200UL

// ==========================================
// PIN I/O & KONFIGURASI SENSOR
// ==========================================
#define Soil   A1
#define DHTPin 8
#define DHTTyp DHT22
DHT dht(DHTPin, DHTTyp);
#define Pompa  4

// Logika Relay (Aktif Low)
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ==========================================
// VARIABEL GLOBAL & BUFFER
// ==========================================
// Buffer Non-Blocking JSON
const int MAX_BUF = 384;
char inputBuffer[MAX_BUF];
int bufIndex = 0;
bool discardCurrentLine = false;
unsigned long lastCharReceivedMillis = 0;

// Parameter Lingkungan & Threshold
float Atas       = 80.0;
float Bawah      = 40.0;
float Kritis     = 20.0;
float tanah      = 0.0;
float suhu       = 0.0;
float kelembapan = 0.0;
int hujan        = 0;
float peluangHujan = 0.0;

// Parameter Durasi Pompa
unsigned long durasiOn = 5000;
unsigned long durasiOff;

// Jadwal Penyiraman (Sinkronisasi dari Web/ESP32)
char jadwalPenyiramanWaktu[6] = "06:55";
int jadwalJam                 = 6;
int jadwalMenit               = 55;
int jadwalPenyiramanDurasiDetik = 5;
bool jadwalPenyiramanAktif    = true;

// Kontrol & Status Sistem
bool faseVegetatif = true;
bool modeManual    = false;   
bool sedangMenyiram = false;
int Nsoil          = 0;
int lastScheduledHour   = -1;
int lastScheduledMinute = -1;

// Variabel Waktu & Skor Perhitungan
unsigned long waktuMulai = 0;
unsigned long waktuAkhir = 0;
float vdp, skorvdp, skorTanah, skorHujan, skorInteraksi, skorTotal;

// Debounce Perintah Manual
unsigned long lastManualToggleMillis = 0;
const unsigned long MANUAL_TOGGLE_DEBOUNCE_MS = 500UL;

// Timer Millis (Non-Blocking Delays)
unsigned long timerDHT       = 0;
unsigned long timerKirimData = 0;

// ==========================================
// LAYOUT EEPROM
// ==========================================
const int EEPROM_KRITIS_ADDR        = 0;
const int EEPROM_ATAS_ADDR          = 4;
const int EEPROM_BAWAH_ADDR         = 8;
const int EEPROM_FASE_ADDR          = 12;
const int EEPROM_JADWAL_AKTIF_ADDR  = 13;
const int EEPROM_JADWAL_WAKTU_ADDR  = 14;
const int EEPROM_JADWAL_DURASI_ADDR = 20;

// ==========================================
// DEKLARASI FUNGSI (PROTOTYPES)
// ==========================================
void kirimDatasensorJSON();
void bacaSensorTanah();
void bacaSensorSuhu();
void hitungSkor();
void terimaDataJSON_NonBlocking();
void controlPompa(unsigned long waktuSekarang);
void processJSON(const char* jsonString);
bool cekWaktuPenyiraman();

// ==========================================
// FUNGSI UTILITY & PARSING JSON
// ==========================================
static const char* findJsonValue(const char* json, const char* key) {
  char pattern[32];
  size_t keylen = strlen(key);
  if (keylen + 3 >= sizeof(pattern)) return NULL;
  
  pattern[0] = '"';
  memcpy(pattern + 1, key, keylen);
  pattern[1 + keylen] = '"';
  pattern[2 + keylen] = '\0';

  const char* p = json;
  while ((p = strstr(p, pattern)) != NULL) {
    const char* q = p + keylen + 2;
    while (*q && *q != ':') {
      if (*q != ' ' && *q != '\t') break;
      q++;
    }
    if (*q != ':') {
      p += keylen + 2;
      continue;
    }
    q++;
    while (*q == ' ' || *q == '\t') q++;
    return q;
  }
  return NULL;
}

static bool parseJsonString(const char* json, const char* key, char* out, size_t len) {
  const char* p = findJsonValue(json, key);
  if (!p || *p != '"') return false;
  p++;
  size_t i = 0;
  while (*p && *p != '"' && i + 1 < len) {
    out[i++] = *p++;
  }
  out[i] = '\0';
  return *p == '"';
}

static bool parseJsonBool(const char* json, const char* key, bool* out) {
  const char* p = findJsonValue(json, key);
  if (!p) return false;
  while (*p == ' ' || *p == '\t' || *p == '"') p++;
  
  if (strncmp(p, "true", 4) == 0 || *p == '1') {
    *out = true;
    return true;
  }
  if (strncmp(p, "false", 5) == 0 || *p == '0') {
    *out = false;
    return true;
  }
  return false;
}

static bool parseJsonInt(const char* json, const char* key, int* out) {
  const char* p = findJsonValue(json, key);
  if (!p) return false;
  while (*p == ' ' || *p == '\t' || *p == '"') p++;
  
  bool neg = false;
  if (*p == '-') {
    neg = true;
    p++;
  }
  
  if (*p < '0' || *p > '9') return false;
  
  int value = 0;
  while (*p >= '0' && *p <= '9') {
    value = value * 10 + (*p - '0');
    p++;
  }
  *out = neg ? -value : value;
  return true;
}

static bool parseJsonFloat(const char* json, const char* key, float* out) {
  const char* p = findJsonValue(json, key);
  if (!p) return false;
  while (*p == ' ' || *p == '\t' || *p == '"') p++;
  
  bool neg = false;
  if (*p == '-') {
    neg = true;
    p++;
  }
  
  if ((*p < '0' || *p > '9') && *p != '.') return false;
  
  float value = 0.0f;
  while (*p >= '0' && *p <= '9') {
    value = value * 10.0f + (*p - '0');
    p++;
  }
  
  if (*p == '.') {
    p++;
    float place = 0.1f;
    while (*p >= '0' && *p <= '9') {
      value += (*p - '0') * place;
      place *= 0.1f;
      p++;
    }
  }
  *out = neg ? -value : value;
  return true;
}

// ==========================================
// FUNGSI PENGATURAN PARAMETER
// ==========================================
static bool normalisasiFaseTanaman(const char* teks, bool defaultVegetatif) {
  if (!teks || teks[0] == '\0') return defaultVegetatif;
  
  char buf[16];
  size_t i = 0;
  const char* p = teks;
  while (*p && i + 1 < sizeof(buf)) {
    char c = *p++;
    if (c >= 'A' && c <= 'Z') c = c - 'A' + 'a';
    buf[i++] = c;
  }
  buf[i] = '\0';

  char* scan = buf;
  while (*scan == ' ' || *scan == '\t') scan++;
  if (strcmp(scan, "generatif") == 0 || strcmp(scan, "generative") == 0) return false;
  if (strcmp(scan, "vegetatif") == 0 || strcmp(scan, "vegetative") == 0) return true;
  
  return defaultVegetatif;
}

static void setFaseTanaman(bool vegetatifBaru, const char* sumber, bool kirimTelemetry) {
  const bool faseSebelumnya = faseVegetatif;
  faseVegetatif = vegetatifBaru;
  EEPROM.put(EEPROM_FASE_ADDR, faseVegetatif);

  if (faseSebelumnya != faseVegetatif) {
    SerialPrintln(F("[SIM] perubahan fase terdeteksi dan ditulis ke EEPROM"));
  }

  // Pertahankan durasi jadwal setelah pembaruan fase
  durasiOn = (unsigned long)jadwalPenyiramanDurasiDetik * 1000UL;
}

static bool parseWaktuPenyiraman(const char* waktuBaru, int& jamBaru, int& menitBaru) {
  if (!waktuBaru || waktuBaru[0] == '\0') return false;

  char buf[8];
  strncpy(buf, waktuBaru, sizeof(buf) - 1);
  buf[sizeof(buf) - 1] = '\0';

  char* colon = strchr(buf, ':');
  if (!colon) return false;

  *colon = '\0';
  int j = atoi(buf);
  int m = atoi(colon + 1);

  if (j < 0 || j > 23 || m < 0 || m > 59) return false;

  jamBaru = j;
  menitBaru = m;
  return true;
}

static bool setJadwalPenyiramanWaktu(const char* waktuBaru) {
  int jamBaru = 0;
  int menitBaru = 0;
  if (!parseWaktuPenyiraman(waktuBaru, jamBaru, menitBaru)) return false;

  char waktuNormal[6];
  snprintf(waktuNormal, sizeof(waktuNormal), "%02d:%02d", jamBaru, menitBaru);
  
  jadwalJam = jamBaru;
  jadwalMenit = menitBaru;

  if (strcmp(jadwalPenyiramanWaktu, waktuNormal) == 0) return false;

  strncpy(jadwalPenyiramanWaktu, waktuNormal, sizeof(jadwalPenyiramanWaktu) - 1);
  jadwalPenyiramanWaktu[sizeof(jadwalPenyiramanWaktu) - 1] = '\0';
  return true;
}

static bool setJadwalPenyiramanDurasi(int durasiBaru) {
  if (durasiBaru < 1) durasiBaru = 1;
  if (durasiBaru == jadwalPenyiramanDurasiDetik) return false;
  
  jadwalPenyiramanDurasiDetik = durasiBaru;
  durasiOn = (unsigned long)jadwalPenyiramanDurasiDetik * 1000UL;
  return true;
}

static bool setJadwalPenyiramanAktif(bool aktifBaru) {
  if (aktifBaru == jadwalPenyiramanAktif) return false;
  jadwalPenyiramanAktif = aktifBaru;
  return true;
}

// ==========================================
// FUNGSI EEPROM
// ==========================================
void muatJadwalDariEEPROM() {
  EEPROM.get(EEPROM_JADWAL_AKTIF_ADDR, jadwalPenyiramanAktif);
  EEPROM.get(EEPROM_JADWAL_WAKTU_ADDR, jadwalPenyiramanWaktu);
  EEPROM.get(EEPROM_JADWAL_DURASI_ADDR, jadwalPenyiramanDurasiDetik);

  int jamBaru = 0;
  int menitBaru = 0;
  if (!parseWaktuPenyiraman(jadwalPenyiramanWaktu, jamBaru, menitBaru)) {
    strncpy(jadwalPenyiramanWaktu, "06:55", sizeof(jadwalPenyiramanWaktu) - 1);
    jadwalPenyiramanWaktu[sizeof(jadwalPenyiramanWaktu) - 1] = '\0';
    jadwalJam = 6;
    jadwalMenit = 55;
  } else {
    jadwalJam = jamBaru;
    jadwalMenit = menitBaru;
  }

  if (jadwalPenyiramanDurasiDetik < 1 || jadwalPenyiramanDurasiDetik > 3600) {
    jadwalPenyiramanDurasiDetik = 5;
  }

  durasiOn = (unsigned long)jadwalPenyiramanDurasiDetik * 1000UL;
}

void simpanJadwalKeEEPROM() {
  EEPROM.put(EEPROM_JADWAL_AKTIF_ADDR, jadwalPenyiramanAktif);
  EEPROM.put(EEPROM_JADWAL_WAKTU_ADDR, jadwalPenyiramanWaktu);
  EEPROM.put(EEPROM_JADWAL_DURASI_ADDR, jadwalPenyiramanDurasiDetik);
}

// ==========================================
// SETUP & LOOP
// ==========================================
void setup() {
  delay(100);
  
  // Inisialisasi Serial
  Serial.begin(ESP32_BAUD);
  Serial.setTimeout(20);
  delay(500);

  // Bersihkan buffer serial yang tersisa
  while (Serial.available() > 0) {
    Serial.read();
  }
  Serial.println(F("=== ARDUINO USB SERIAL READY ==="));
  
  dht.begin();
  
  // Inisialisasi Relay Pompa
  pinMode(Pompa, OUTPUT);
  digitalWrite(Pompa, RELAY_OFF); 
  
  if (!rtc.begin()) {
    SerialPrintln(F("RTC tidak ditemukan!"));
  }
  
  // Ambil Data dari EEPROM 
  EEPROM.get(EEPROM_KRITIS_ADDR, Kritis);
  EEPROM.get(EEPROM_ATAS_ADDR, Atas);
  EEPROM.get(EEPROM_BAWAH_ADDR, Bawah);
  EEPROM.get(EEPROM_FASE_ADDR, faseVegetatif);
  muatJadwalDariEEPROM();

  // Pembacaan awal sensor
  suhu = dht.readTemperature();
  kelembapan = dht.readHumidity();
  
  delay(500);
  SerialPrintln(F("=== ARDUINO STARTUP ==="));
  SerialPrint(F("Relay Pin: "));
  SerialPrintln(Pompa);
  SerialPrint(F("Relay Initial State: "));
  SerialPrintln(digitalRead(Pompa) == RELAY_ON ? F("ON (LOW)") : F("OFF (HIGH)"));
  SerialPrintln(F("=== LISTENING FOR ESP32 ==="));
  delay(1000);
  
  // Kirim telemetri awal ke ESP32
  kirimDatasensorJSON();
  delay(200);
}

void loop() {
  unsigned long waktuSekarang = millis();  
  
  bacaSensorTanah();
  hitungSkor();
  
  // Timer pembacaan DHT (5 detik)
  if (waktuSekarang - timerDHT >= 5000) {
    timerDHT = waktuSekarang;
    bacaSensorSuhu();
    hitungSkor();
  }
  
  terimaDataJSON_NonBlocking();
  controlPompa(waktuSekarang);
  
  // Timer pengiriman data telemetri (1 detik)
  if (waktuSekarang - timerKirimData >= 1000) {
    timerKirimData = waktuSekarang;
    kirimDatasensorJSON();
  }
}

// ==========================================
// FUNGSI NON-BLOCKING JSON
// ==========================================
void terimaDataJSON_NonBlocking() {
  while (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    
    // Hanya terima karakter standar ASCII & pembatas baris
    if (inChar != '\n' && inChar != '\r' && (inChar < 32 || inChar > 126)) {
      continue;
    }

    unsigned long now = millis();
    if (bufIndex > 0 && now - lastCharReceivedMillis > 250) {
      // Buang data jika buffer tertahan terlalu lama (stalled)
      bufIndex = 0;
      discardCurrentLine = false;
    }
    lastCharReceivedMillis = now;

    if (discardCurrentLine) {
      if (inChar == '\n' || inChar == '\r') {
        discardCurrentLine = false;
      }
      continue;
    }

    if (inChar == '\n' || inChar == '\r') {
      if (bufIndex > 0) {
        inputBuffer[bufIndex] = '\0';
        
        // Ekstrak objek JSON pertama dalam buffer
        char* start = strchr(inputBuffer, '{');
        char* end = strrchr(inputBuffer, '}');
        
        if (start && end && end > start) {
          size_t len = end - start + 1;
          if (len >= (size_t)MAX_BUF) len = MAX_BUF - 1;
          memmove(inputBuffer, start, len);
          inputBuffer[len] = '\0';
          
          SerialPrint(F("[ESP->ARDUINO] "));
          SerialPrintln(inputBuffer);
          processJSON(inputBuffer);
        } else {
          if (strchr(inputBuffer, '{') != NULL) {
            SerialPrint(F("[ESP->ARDUINO] Ignored or partial: "));
            SerialPrintln(inputBuffer);
          }
          if (strstr(inputBuffer, "request_telemetry") != NULL) {
            SerialPrintln(F("[ESP->ARDUINO] request_telemetry (fallback) detected"));
            kirimDatasensorJSON();
            delay(30);
            kirimDatasensorJSON();
          }
        }
      }
      bufIndex = 0;
    } else {
      if (bufIndex == 0 && inChar != '{') {
        // Abaikan karakter sisa sebelum awal JSON
        continue;
      }
      if (bufIndex < MAX_BUF - 1) {
        inputBuffer[bufIndex++] = inChar;
      } else {
        discardCurrentLine = true;
        bufIndex = 0;
      }
    }
  }
}

static void kirimAckHeartbeat() {
  Serial.println(F("{\"type\":\"ack\",\"action\":\"heartbeat\"}"));
  Serial.flush();
}

void processJSON(const char* jsonString) {
  if (!jsonString || jsonString[0] == '\0' || jsonString[0] != '{') {
    return;
  }

  size_t jsonLen = strlen(jsonString);
  if (jsonLen >= MAX_BUF) return;

  char value[24];
  char typeVal[24];
  
  if (parseJsonString(jsonString, "type", typeVal, sizeof(typeVal))) {
    
    // Tipe: pref_ack
    if (strcmp(typeVal, "pref_ack") == 0) {
      char timeBuf[16] = "";
      int dur = 0;
      bool sched = false;
      float tk = NAN, ta = NAN, tb = NAN;
      char phase[24] = "";

      parseJsonString(jsonString, "watering_time", timeBuf, sizeof(timeBuf));
      parseJsonInt(jsonString, "watering_duration", &dur);
      parseJsonBool(jsonString, "schedule_enabled", &sched);
      parseJsonFloat(jsonString, "threshold_kritis", &tk);
      parseJsonFloat(jsonString, "threshold_atas", &ta);
      parseJsonFloat(jsonString, "threshold_bawah", &tb);
      parseJsonString(jsonString, "plant_phase", phase, sizeof(phase));

      bool wroteEEPROM = false;
      
      if (!isnan(tk) && tk != Kritis) {
        Kritis = tk;
        EEPROM.put(EEPROM_KRITIS_ADDR, Kritis);
        wroteEEPROM = true;
      }
      if (!isnan(ta) && ta != Atas) {
        Atas = ta;
        EEPROM.put(EEPROM_ATAS_ADDR, Atas);
        wroteEEPROM = true;
      }
      if (!isnan(tb) && tb != Bawah) {
        Bawah = tb;
        EEPROM.put(EEPROM_BAWAH_ADDR, Bawah);
        wroteEEPROM = true;
      }
      
      if (phase[0] != '\0') {
        bool faseBaru = normalisasiFaseTanaman(phase, faseVegetatif);
        if (faseBaru != faseVegetatif) {
          setFaseTanaman(faseBaru, "pref_ack", true);
          wroteEEPROM = true;
        }
      }

      bool jadwalBerubah = false;
      if (timeBuf[0] != '\0' && setJadwalPenyiramanWaktu(timeBuf)) jadwalBerubah = true;
      if (dur > 0 && setJadwalPenyiramanDurasi(dur)) jadwalBerubah = true;
      if (sched != jadwalPenyiramanAktif && setJadwalPenyiramanAktif(sched)) jadwalBerubah = true;
      
      if (jadwalBerubah) {
        simpanJadwalKeEEPROM();
        wroteEEPROM = true;
      }

      if (wroteEEPROM) {
        SerialPrintln(F("[PREF_ACK] Settings applied and persisted"));
      } else {
        SerialPrintln(F("[PREF_ACK] No persistable settings found or no change"));
      }

      Serial.print(F("{\"type\":\"pref_ack_resp\",\"action\":\"received\""));
      if (timeBuf[0] != '\0') { Serial.print(F(",\"watering_time\":\"")); Serial.print(timeBuf); Serial.print('"'); }
      if (dur > 0) { Serial.print(F(",\"watering_duration\":")); Serial.print(dur); }
      Serial.print(F(",\"status\":\"ok\"}\n"));
      Serial.flush();
      SerialPrintln(F("[ESP->ARDUINO] pref_ack_resp sent"));
      return;
    }
    
    // Tipe: heartbeat
    else if (strcmp(typeVal, "heartbeat") == 0) {
      kirimAckHeartbeat();
      SerialPrintln(F("[ESP->ARDUINO] heartbeat ACK sent"));
      return;
    }
    
    // Tipe: request_telemetry
    else if (strcmp(typeVal, "request_telemetry") == 0) {
      SerialPrintln(F("[ESP->ARDUINO] request_telemetry received"));
      kirimDatasensorJSON();
      delay(30);
      kirimDatasensorJSON();
      return;
    }
    
    // Tipe: cmd request_telemetry
    else if (strcmp(typeVal, "cmd") == 0) {
      if (parseJsonString(jsonString, "action", value, sizeof(value)) && strcmp(value, "request_telemetry") == 0) {
        SerialPrintln(F("[ESP->ARDUINO] cmd request_telemetry received"));
        kirimDatasensorJSON();
        delay(30);
        kirimDatasensorJSON();
        return;
      }
    }
  }

  // Tipe: cmd action
  bool isCommand = false;
  if (parseJsonString(jsonString, "type", value, sizeof(value))) {
    isCommand = (strcmp(value, "cmd") == 0);
  }
  if (!isCommand) return;
  if (!parseJsonString(jsonString, "action", value, sizeof(value))) return;

  if (strcmp(value, "set_pump") == 0) {
    bool pumpOn = false;
    if (!parseJsonBool(jsonString, "pump_state", &pumpOn)) {
      SerialPrintln(F("[ESP->ARDUINO] parse pump_state failed"));
      return;
    }

    bool currentOn = (digitalRead(Pompa) == RELAY_ON);
    if (pumpOn == currentOn) {
      bool autoMode = false;
      bool hasAutoMode = parseJsonBool(jsonString, "auto_mode", &autoMode);
      if (hasAutoMode && (modeManual == autoMode)) {
        modeManual = !autoMode;
      }
    } else {
      unsigned long now = millis();
      if (now - lastManualToggleMillis < MANUAL_TOGGLE_DEBOUNCE_MS) {
        SerialPrintln(F("[ESP->ARDUINO] Ignored rapid manual toggle"));
      } else {
        bool autoMode = false;
        bool hasAutoMode = parseJsonBool(jsonString, "auto_mode", &autoMode);

        digitalWrite(Pompa, pumpOn ? RELAY_ON : RELAY_OFF);
        sedangMenyiram = pumpOn;
        if (pumpOn) waktuMulai = now;
        else waktuAkhir = now;
        
        if (hasAutoMode) modeManual = !autoMode;
        lastManualToggleMillis = now;
      }
    }

    SerialPrint(F("[ESP->ARDUINO] set_pump: "));
    SerialPrintln(pumpOn ? F("ON") : F("OFF"));
    SerialPrint(F("[ESP->ARDUINO] mode: "));
    SerialPrintln(modeManual ? F("MANUAL") : F("AUTO"));

    Serial.print(F("{\"type\":\"ack\",\"action\":\"set_pump\",\"status\":\""));
    Serial.print(pumpOn ? F("ON") : F("OFF"));
    Serial.print(F("\"}\n"));
    Serial.flush();
    kirimDatasensorJSON();
    SerialPrintln(F("[ESP->ARDUINO] set_pump ACK sent"));
    return;
  }
  
  else if (strcmp(value, "set_mode") == 0) {
    bool autoMode = false;
    if (parseJsonBool(jsonString, "auto_mode", &autoMode)) {
      bool newModeManual = !autoMode;
      if (newModeManual != modeManual) {
        modeManual = newModeManual;
        SerialPrintln(modeManual ? F("MANUAL") : F("AUTO"));
      } else {
        SerialPrintln(F("[ESP->ARDUINO] set_mode no change"));
      }

      if (!modeManual) {
        hitungSkor();
        controlPompa(millis());
      }

      Serial.print(F("{\"type\":\"ack\",\"action\":\"set_mode\",\"status\":\""));
      Serial.print(modeManual ? F("MANUAL") : F("AUTO"));
      Serial.print(F("\"}\n"));
      Serial.flush();
      SerialPrintln(F("[ESP->ARDUINO] set_mode ACK sent"));

      kirimDatasensorJSON();
    }
  }
  
  else if (strcmp(value, "sync_state") == 0 || strcmp(value, "sync_thresholds") == 0) {
    bool adaPerubahan = false;
    SerialPrintln(F("[ESP->ARDUINO] received settings/weather sync"));
    
    char locBuf[32] = "";
    if (parseJsonString(jsonString, "location", locBuf, sizeof(locBuf)) ||
        parseJsonString(jsonString, "weather_location", locBuf, sizeof(locBuf))) {
      SerialPrint(F("  location: ")); SerialPrintln(locBuf);
    }
    
    char weatherBuf[24] = "";
    if (parseJsonString(jsonString, "weather_condition", weatherBuf, sizeof(weatherBuf))) {
      SerialPrint(F("  weather_condition: ")); SerialPrintln(weatherBuf);
    }
    
    float tempWeather = 0.0f;
    if (parseJsonFloat(jsonString, "weather_temperature", &tempWeather)) {
      SerialPrint(F("  weather_temperature: ")); SerialPrintln(tempWeather);
    }
    
    float rainChance = 0.0f;
    if (parseJsonFloat(jsonString, "weather_rain_chance", &rainChance) ||
        parseJsonFloat(jsonString, "rain", &rainChance)) {
      SerialPrint(F("  weather_rain_chance: ")); SerialPrintln(rainChance);
      peluangHujan = rainChance;
      hujan = (int)(peluangHujan / 20.0);
    }

    if (parseJsonString(jsonString, "plant_phase", value, sizeof(value)) ||
        parseJsonString(jsonString, "crop_mode", value, sizeof(value))) {
      bool faseBaru = normalisasiFaseTanaman(value, faseVegetatif);
      if (faseBaru != faseVegetatif) {
        setFaseTanaman(faseBaru, "ESP32 sync", false);
        adaPerubahan = true;
      }
    }

    float nilaiBaru = 0.0f;
    if (parseJsonFloat(jsonString, "threshold_kritis", &nilaiBaru) ||
        parseJsonFloat(jsonString, "soil_threshold_critical", &nilaiBaru)) {
      if (nilaiBaru != Kritis) {
        Kritis = nilaiBaru;
        EEPROM.put(EEPROM_KRITIS_ADDR, Kritis);
        adaPerubahan = true;
      }
    }

    if (parseJsonFloat(jsonString, "threshold_atas", &nilaiBaru) ||
        parseJsonFloat(jsonString, "soil_threshold_high", &nilaiBaru)) {
      if (nilaiBaru != Atas) {
        Atas = nilaiBaru;
        EEPROM.put(EEPROM_ATAS_ADDR, Atas);
        adaPerubahan = true;
      }
    }

    if (parseJsonFloat(jsonString, "threshold_bawah", &nilaiBaru) ||
        parseJsonFloat(jsonString, "soil_threshold_low", &nilaiBaru)) {
      if (nilaiBaru != Bawah) {
        Bawah = nilaiBaru;
        EEPROM.put(EEPROM_BAWAH_ADDR, Bawah);
        adaPerubahan = true;
      }
    }

    bool tempBool = false;
    if (parseJsonBool(jsonString, "auto_mode", &tempBool)) {
      modeManual = !tempBool;
    }

    bool jadwalBerubah = false;
    if (parseJsonString(jsonString, "watering_time", value, sizeof(value))) {
      if (setJadwalPenyiramanWaktu(value)) jadwalBerubah = true;
    }

    int durasiBaru = 0;
    if (parseJsonInt(jsonString, "watering_duration", &durasiBaru)) {
      if (setJadwalPenyiramanDurasi(durasiBaru)) jadwalBerubah = true;
    }

    bool enabled = false;
    if (parseJsonBool(jsonString, "watering_enabled", &enabled) ||
        parseJsonBool(jsonString, "schedule_enabled", &enabled)) {
      if (setJadwalPenyiramanAktif(enabled)) jadwalBerubah = true;
    }

    if (adaPerubahan || jadwalBerubah) {
      simpanJadwalKeEEPROM();
      hitungSkor();
      controlPompa(millis());
      kirimDatasensorJSON();
      Serial.print(F("{\"type\":\"sync_ack\",\"status\":\"ok\"}\n"));
      Serial.flush();
    }
    
    // Log Pengaturan yang Diterapkan
    SerialPrintln(F("[ESP->ARDUINO] Applied settings:"));
    SerialPrint(F("  watering_time: ")); SerialPrintln(jadwalPenyiramanWaktu);
    SerialPrint(F("  watering_duration: ")); SerialPrintln(jadwalPenyiramanDurasiDetik);
    SerialPrint(F("  schedule_enabled: ")); SerialPrintln(jadwalPenyiramanAktif ? F("YA") : F("TIDAK"));
    SerialPrint(F("  threshold_kritis: ")); SerialPrintln(Kritis);
    SerialPrint(F("  threshold_atas: ")); SerialPrintln(Atas);
    SerialPrint(F("  threshold_bawah: ")); SerialPrintln(Bawah);
    SerialPrint(F("  auto_mode: ")); SerialPrintln(modeManual ? F("MANUAL") : F("AUTO"));
    SerialPrint(F("  plant_phase: ")); SerialPrintln(faseVegetatif ? F("vegetatif") : F("generatif"));
    SerialPrint(F("[SCORE] soil_score: ")); SerialPrintln(skorTanah);
    SerialPrint(F("[SCORE] total_score: ")); SerialPrintln(skorTotal);
    SerialPrint(F("[PUMP] status: ")); SerialPrintln(digitalRead(Pompa) == RELAY_ON ? F("ON") : F("OFF"));
  }
}

// ==========================================
// FUNGSI PEMBACAAN SENSOR & LOGIKA KONTROL
// ==========================================
void bacaSensorTanah() {
  Nsoil = analogRead(Soil);
  tanah = map(Nsoil, 400, 200, 0, 100);
  tanah = constrain(tanah, 0, 100);
}

void bacaSensorSuhu() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (!isnan(h) && !isnan(t) && fabs(h - t) > 0.01f) {
    kelembapan = h;
    suhu = t;
    return;
  }

  delay(50);
  h = dht.readHumidity();
  t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    kelembapan = h;
    suhu = t;
  }
}

void hitungSkor() {
  if (isnan(suhu) || isnan(kelembapan) || suhu == 0.0 || kelembapan == 0.0) return;

  float svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3));
  vdp = svp * (1.0 - (kelembapan / 100.0));
  vdp = constrain(vdp, 0.4, 2.0);

  if (Atas - Kritis == 0) Kritis = Atas - 1;

  skorTanah = ((Atas - tanah) * 50.0) / (Atas - Kritis);
  skorTanah = constrain(skorTanah, 0, 50);

  skorvdp = ((vdp - 0.4) * 30.0) / (2.0 - 0.4);

  skorHujan = (peluangHujan / 100.0) * 40.0;
  skorHujan = constrain(skorHujan, 0, 40);

  skorInteraksi = (skorTanah * skorvdp) / 50.0;
  skorInteraksi = constrain(skorInteraksi, 0, 30);

  skorTotal = skorTanah + skorvdp + skorInteraksi - skorHujan;
  durasiOff = 30000 * (1.0 + ((Atas - tanah) / 100.0));
}

void kirimDatasensorJSON() {
  if (isnan(tanah)) return;

  char tempBuf[8], humBuf[8], soilBuf[8], scoreBuf[10];
  char soilScoreBuf[10], vpdBuf[8], vdpScoreBuf[8], rainScoreBuf[8];
  char durasiOffBuf[12], kritisBuf[8], atasBuf[8], bawahBuf[8];

  dtostrf(suhu, 1, 1, tempBuf);
  dtostrf(kelembapan, 1, 1, humBuf);
  dtostrf(tanah, 1, 1, soilBuf);
  dtostrf(skorTotal, 1, 2, scoreBuf);
  dtostrf(skorTanah, 1, 2, soilScoreBuf);
  dtostrf(vdp, 1, 2, vpdBuf);
  dtostrf(skorvdp, 1, 2, vdpScoreBuf);
  dtostrf(skorHujan, 1, 2, rainScoreBuf);
  dtostrf((double)durasiOff, 1, 0, durasiOffBuf);
  dtostrf(Kritis, 1, 2, kritisBuf);
  dtostrf(Atas, 1, 2, atasBuf);
  dtostrf(Bawah, 1, 2, bawahBuf);

  Serial.print(F("{\"type\":\"telemetry\",\"device_id\":\"E1\",\"sensor_source\":\"ars\",\"temperature\":"));
  Serial.print(tempBuf);
  Serial.print(F(",\"humidity\":"));
  Serial.print(humBuf);
  Serial.print(F(",\"soil_moisture\":"));
  Serial.print(soilBuf);
  Serial.print(F(",\"relay_state\":"));
  Serial.print(digitalRead(Pompa) == RELAY_ON ? F("true") : F("false"));
  Serial.print(F(",\"led_state\":false,\"auto_mode\":"));
  Serial.print(!modeManual ? F("true") : F("false"));
  Serial.print(F(",\"plant_phase\":\""));
  Serial.print(faseVegetatif ? F("vegetatif") : F("generatif"));
  Serial.print(F("\",\"threshold_kritis\":"));
  Serial.print(kritisBuf);
  Serial.print(F(",\"threshold_atas\":"));
  Serial.print(atasBuf);
  Serial.print(F(",\"threshold_bawah\":"));
  Serial.print(bawahBuf);
  Serial.print(F(",\"watering_time\":\""));
  Serial.print(jadwalPenyiramanWaktu);
  Serial.print(F("\",\"watering_duration\":"));
  Serial.print(jadwalPenyiramanDurasiDetik);
  Serial.print(F(",\"watering_active\":"));
  Serial.print(sedangMenyiram ? F("true") : F("false"));
  Serial.print(F(",\"schedule_enabled\":"));
  Serial.print(jadwalPenyiramanAktif ? F("true") : F("false"));
  Serial.print(F(",\"score\":"));
  Serial.print(scoreBuf);
  Serial.print(F(",\"soil_score\":"));
  Serial.print(soilScoreBuf);
  Serial.print(F(",\"vpd\":"));
  Serial.print(vpdBuf);
  Serial.print(F(",\"vdp_score\":"));
  Serial.print(vdpScoreBuf);
  Serial.print(F(",\"rain_score\":"));
  Serial.print(rainScoreBuf);
  Serial.print(F(",\"duration_estimate\":"));
  Serial.print(durasiOffBuf);
  Serial.print(F("}\n"));
  Serial.flush();
}

void controlPompa(unsigned long waktuSekarang) {
  if (modeManual) return;

  if (!jadwalPenyiramanAktif) {
    if (digitalRead(Pompa) == RELAY_ON || sedangMenyiram) {
      digitalWrite(Pompa, RELAY_OFF);
      sedangMenyiram = false;
      waktuAkhir = waktuSekarang;
    }
    return;
  }

  if (hujan >= 5 || tanah >= Atas) {
    if (digitalRead(Pompa) == RELAY_ON || sedangMenyiram) {
      digitalWrite(Pompa, RELAY_OFF);
      sedangMenyiram = false;
      waktuAkhir = waktuSekarang;
    }
    return;
  }

  if (sedangMenyiram) {
    if (waktuSekarang - waktuMulai >= durasiOn) {
      digitalWrite(Pompa, RELAY_OFF);
      sedangMenyiram = false;
      waktuAkhir = waktuSekarang;
    }
    return;
  }

  if (!cekWaktuPenyiraman()) return;

  unsigned long requiredCooldown = durasiOff;
  if (waktuSekarang - waktuAkhir <= requiredCooldown) return;

  if ((faseVegetatif && skorTotal <= 55) || (!faseVegetatif && skorTotal <= 60)) return;

  sedangMenyiram = true;
  waktuMulai = waktuSekarang;
  digitalWrite(Pompa, RELAY_ON);
}

bool cekWaktuPenyiraman() {
  if (!jadwalPenyiramanAktif) return false;

  DateTime waktuSekarang = rtc.now();
  int jam = waktuSekarang.hour();
  int menit = waktuSekarang.minute();

  if (jam == jadwalJam && menit == jadwalMenit) {
    if (lastScheduledHour == jam && lastScheduledMinute == menit) {
      return false;
    }
    lastScheduledHour = jam;
    lastScheduledMinute = menit;
    return true;
  }

  lastScheduledHour = -1;
  lastScheduledMinute = -1;
  return false;
}