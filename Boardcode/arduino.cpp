// LIBRARY
#include <DHT.h>
#include <EEPROM.h>
#include <math.h>
#include <RTClib.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>

RTC_DS3231 rtc;

// PIN KOMUNIKASI ESP32 (SoftwareSerial)
#define RX 2 
#define TX 3 
SoftwareSerial espSerial(RX, TX);

// PIN IO
#define Soil A1
#define DHTPin 8
#define DHTTyp DHT11
DHT dht(DHTPin, DHTTyp);
#define Pompa 4

// ==========================================
// LOGIKA RELAY AKTIF LOW
// ==========================================
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// BUFFER NON-BLOCKING JSON - KURANGI UNTUK SAVE RAM (256 sudah cukup untuk command JSON)
const int MAX_BUF = 256; 
char inputBuffer[MAX_BUF];
int bufIndex = 0;

// GLOBAL JSON DOCUMENT - TIDAK ALLOCATE DI STACK
StaticJsonDocument<256> globalJsonDoc;
// VARIABEL GLOBAL
float Atas = 80.0;
float Bawah = 40.0;
float Kritis = 20.0;
float tanah = 0.0;
float suhu = 0.0;
float kelembapan = 0.0;
int hujan = 0; 
unsigned long durasiOn = 5000;
unsigned long durasiOff;

// VARIABEL KONTROL & STATUS
bool faseVegetatif = true;
bool modeManual = false;   
bool sedangMenyiram = false;
bool isEspOnline = false;

// ===== VARIABEL SIMULASI SERIAL =====
bool modeSimulasi = false;
bool simulasiWaktuValid = false;

unsigned long waktuMulai = 0;
unsigned long waktuAkhir = 0;
float vdp, skorvdp, skorTanah, skorHujan, skorInteraksi, skorTotal;
int Nsoil;

DateTime now;

// TIMER MILLIS
unsigned long timerTanah = 0;
unsigned long timerDHT = 0;
unsigned long timerKirimData = 0;

void kirimDatasensorJSON();

static bool normalisasiFaseTanaman(JsonVariantConst nilai, bool defaultVegetatif) {
  if (nilai.isNull()) return defaultVegetatif;

  if (nilai.is<const char*>()) {
    String teks = nilai.as<const char*>();
    teks.trim();
    teks.toLowerCase();

    if (teks == "generatif") return false;
    if (teks == "vegetatif") return true;
  }
  return defaultVegetatif;
}

static void setFaseTanaman(bool vegetatifBaru, const char* sumber, bool kirimTelemetry) {
  const bool faseSebelumnya = faseVegetatif;
  faseVegetatif = vegetatifBaru;
  EEPROM.put(12, faseVegetatif);

  Serial.print(F("[SIM] "));
  if (sumber && sumber[0] != '\0') {
    Serial.print(sumber);
    Serial.print(F(" | "));
  }
  Serial.print(F("fase tanaman disimpan: "));
  Serial.println(faseVegetatif ? F("vegetatif") : F("generatif"));

  if (faseSebelumnya != faseVegetatif) {
    Serial.println(F("[SIM] perubahan fase terdeteksi dan ditulis ke EEPROM"));
  }

  Serial.print(F("[SIM] mode simulasi: "));
  Serial.println(modeSimulasi ? F("AKTIF") : F("MATI"));
  if (kirimTelemetry) {
    Serial.println(F("[SIM] status fase akan dikirim ke ESP32/Web"));
    kirimDatasensorJSON();
    Serial.println(F("[SIM] telemetry fase terkirim"));
  } else {
    Serial.println(F("[SIM] status fase siap dikirim ke ESP32/Web"));
  }
}

void setup() {
  Serial.begin(9600);
  delay(100);
  
  // Clear any garbage in espSerial buffer
  while (espSerial.available() > 0) {
    espSerial.read();
  }
  
  espSerial.begin(9600);
  espSerial.setTimeout(50);
  
  dht.begin();
  
  // INISIALISASI RELAY AKTIF LOW
  pinMode(Pompa, OUTPUT);
  digitalWrite(Pompa, RELAY_OFF); // Pastikan pompa MATI saat pertama kali nyala
  
  if (!rtc.begin()) {
    Serial.println(F("RTC tidak ditemukan!"));
  }
  
  // MENGAMBIL DATA EEPROM 
  EEPROM.get(0, Kritis);
  EEPROM.get(4, Atas);
  EEPROM.get(8, Bawah);
  EEPROM.get(12, faseVegetatif);

  // Baca awal untuk mengisi variabel kosong
  suhu = dht.readTemperature();
  kelembapan = dht.readHumidity();
  
  delay(500);
  Serial.println(F("=== ARDUINO STARTUP ==="));
  Serial.print(F("Relay Pin: "));
  Serial.println(Pompa);
  Serial.print(F("Relay Initial State: "));
  Serial.println(digitalRead(Pompa) == RELAY_ON ? F("ON (LOW)") : F("OFF (HIGH)"));
  Serial.println(F("=== LISTENING FOR ESP32 ==="));
  delay(1000);
}

void loop() {
  unsigned long waktuSekarang = millis();  
  
  debuggingNilai(); 
  terimaDataJSON_NonBlocking();
  bacaSensorTanah();
  hitungSkor();
  
  if (waktuSekarang - timerDHT >= 1000) {
    timerDHT = waktuSekarang;
    bacaSensorSuhu();
    hitungSkor();
  }
  
  controlPompa(waktuSekarang);
  
  if (waktuSekarang - timerKirimData >= 1000) {
    timerKirimData = waktuSekarang;
    kirimDatasensorJSON();
  }
}
// FUNGSI NON-BLOCKING JSON
void terimaDataJSON_NonBlocking() {
  while (espSerial.available() > 0) {
    char inChar = (char)espSerial.read();
    
    // Skip non-printable chars yang biasanya jadi garbage
    if (inChar < 32 && inChar != '\n' && inChar != '\r') {
      Serial.print(F("[SKIP] Garbage byte: 0x"));
      Serial.println((byte)inChar, HEX);
      Serial.flush();
      continue;
    }
    
    if (inChar == '\n' || inChar == '\r') {
      if (bufIndex > 0 && inputBuffer[0] == '{') {  // Only process if starts with {
        inputBuffer[bufIndex] = '\0';
        Serial.print(F("[RX] Raw JSON: "));
        Serial.println(inputBuffer);
        Serial.flush();
        Serial.print(F("[RX] Length: "));
        Serial.print(bufIndex);
        Serial.println(F(" bytes"));
        Serial.flush();
        
        processJSON(inputBuffer);
      }
      bufIndex = 0;  // Always clear buffer after newline
      Serial.flush();
    } else if (bufIndex < MAX_BUF - 1) {
      inputBuffer[bufIndex++] = inChar;
    } else {
      // Buffer full - reset and log
      Serial.print(F("[ERROR] Buffer overflow! Partial: "));
      Serial.println(inputBuffer);
      Serial.flush();
      bufIndex = 0;
    }
  }
}

void processJSON(char* jsonString) {
  if (!jsonString || strlen(jsonString) == 0) {
    Serial.println(F("[ERROR] Empty JSON string"));
    Serial.flush();
    return;
  }
  
  // Check for reasonable JSON length
  size_t jsonLen = strlen(jsonString);
  if (jsonLen > 500) {
    Serial.print(F("[ERROR] JSON too long: "));
    Serial.println(jsonLen);
    Serial.flush();
    return;
  }
  
  Serial.print(F("[PARSE] Attempting to parse: "));
  Serial.println(jsonString);
  Serial.flush();
  
  // USE GLOBAL DOCUMENT - NO STACK ALLOCATION
  globalJsonDoc.clear();
  
  Serial.println(F("[PARSE] Before deserialize..."));
  Serial.flush();
  
  DeserializationError error = deserializeJson(globalJsonDoc, jsonString);
  
  Serial.println(F("[PARSE] After deserialize..."));
  Serial.flush();
  
  if (error) {
    Serial.print(F("[ERROR] JSON parse failed: "));
    Serial.println(error.c_str());
    Serial.flush();
    globalJsonDoc.clear();
    return;
  }
  
  Serial.println(F("[PARSE] Success!"));
  Serial.flush();
  
  const char* type = globalJsonDoc["type"] | "";
  const char* action = globalJsonDoc["action"] | "";
  
  Serial.print(F("[JSON] type="));
  Serial.print(type);
  Serial.print(F(" action="));
  Serial.println(action);
  Serial.flush();
  
  if (strcmp(type, "cmd") == 0) {
    if (strcmp(action, "set_pump") == 0) {
      bool pumpOn = globalJsonDoc["pump_state"] | false;
      Serial.print(F("[CMD] set_pump -> "));
      Serial.print(pumpOn ? F("ON") : F("OFF"));
      Serial.print(F(" | Relay pin "));
      Serial.print(Pompa);
      Serial.print(F(" setting to "));
      Serial.println(pumpOn ? F("LOW") : F("HIGH"));
      Serial.flush();
      
      digitalWrite(Pompa, pumpOn ? RELAY_ON : RELAY_OFF);
      sedangMenyiram = pumpOn;
      modeManual = true;
      
      Serial.print(F("[PIN] Read back: "));
      Serial.println(digitalRead(Pompa) == RELAY_ON ? F("ON (LOW)") : F("OFF (HIGH)"));
      Serial.flush();
    }
    else if (strcmp(action, "sync_state") == 0 || strcmp(action, "sync_thresholds") == 0) {
      Serial.println(F("[CMD] sync received"));
      Serial.flush();

      bool adaPerubahan = false;

      if (globalJsonDoc.containsKey("plant_phase") || globalJsonDoc.containsKey("crop_mode")) {
        bool faseBaru = normalisasiFaseTanaman(
          globalJsonDoc["plant_phase"].isNull() ? globalJsonDoc["crop_mode"] : globalJsonDoc["plant_phase"],
          faseVegetatif
        );
        if (faseBaru != faseVegetatif) {
          setFaseTanaman(faseBaru, "ESP32 sync", false);
          adaPerubahan = true;
          Serial.print(F("[SYNC] plant_phase -> "));
          Serial.println(faseVegetatif ? F("vegetatif") : F("generatif"));
        }
      }

      if (globalJsonDoc.containsKey("threshold_kritis") || globalJsonDoc.containsKey("soil_threshold_critical")) {
        float nilaiBaru = globalJsonDoc.containsKey("threshold_kritis")
          ? globalJsonDoc["threshold_kritis"] | Kritis
          : globalJsonDoc["soil_threshold_critical"] | Kritis;
        if (nilaiBaru != Kritis) {
          Kritis = nilaiBaru;
          EEPROM.put(0, Kritis);
          adaPerubahan = true;
        }
      }

      if (globalJsonDoc.containsKey("threshold_atas") || globalJsonDoc.containsKey("soil_threshold_high")) {
        float nilaiBaru = globalJsonDoc.containsKey("threshold_atas")
          ? globalJsonDoc["threshold_atas"] | Atas
          : globalJsonDoc["soil_threshold_high"] | Atas;
        if (nilaiBaru != Atas) {
          Atas = nilaiBaru;
          EEPROM.put(4, Atas);
          adaPerubahan = true;
        }
      }

      if (globalJsonDoc.containsKey("threshold_bawah") || globalJsonDoc.containsKey("soil_threshold_low")) {
        float nilaiBaru = globalJsonDoc.containsKey("threshold_bawah")
          ? globalJsonDoc["threshold_bawah"] | Bawah
          : globalJsonDoc["soil_threshold_low"] | Bawah;
        if (nilaiBaru != Bawah) {
          Bawah = nilaiBaru;
          EEPROM.put(8, Bawah);
          adaPerubahan = true;
        }
      }

      if (globalJsonDoc.containsKey("auto_mode")) {
        modeManual = !(globalJsonDoc["auto_mode"].as<bool>());
      }

      if (adaPerubahan) {
        Serial.println(F("[SYNC] Pengaturan disimpan ke EEPROM"));
        kirimDatasensorJSON();
        Serial.println(F("[SYNC] status terbaru sudah dikirim ke ESP32/Web"));
      }
    }
    else {
      Serial.print(F("[WARN] Unknown action: "));
      Serial.println(action);
      Serial.flush();
    }
  } else {
    Serial.print(F("[WARN] Unknown type: "));
    Serial.println(type);
    Serial.flush();
  }
  
  globalJsonDoc.clear();
}
void bacaSensorTanah() {
  if (modeSimulasi) return; 

  Nsoil = analogRead(Soil);
  tanah = map(Nsoil, 400, 200, 0, 100);
  tanah = constrain(tanah, 0, 100);
}

void bacaSensorSuhu() {
  if (modeSimulasi) return; 

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (!isnan(h) && !isnan(t)) {
    kelembapan = h;
    suhu = t;
  }
}

void hitungSkor() {
  // Pada mode simulasi, nilai suhu/kelembapan bisa bernilai 0 dan tetap harus dihitung
  // (selama bukan NAN).
  if (isnan(suhu) || isnan(kelembapan)) return;
  float svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3));

  vdp = svp * (1.0 - (kelembapan / 100.0)); 
  vdp = constrain(vdp, 0.4, 2.0);
  
  if (Atas - Kritis == 0) Kritis = Atas - 1;
  
  skorTanah = ((Atas - tanah) * 50.0) / (Atas - Kritis);
  skorTanah = constrain(skorTanah, 0, 50);
  
  skorvdp = ((vdp - 0.4) * 30.0) / (2.0 - 0.4); 
  skorHujan = constrain(hujan * 8.0, 0, 40); 

  skorInteraksi = (skorTanah * skorvdp) / 50.0;
  skorInteraksi = constrain(skorInteraksi, 0, 30);
  
  skorTotal = skorTanah + skorvdp + skorInteraksi - skorHujan;
  durasiOff = 10000 * (1.0 + ((Atas - tanah) / 100.0));
}

void terimaDataJSON() {
  if (espSerial.available() > 0) {
    String input = espSerial.readStringUntil('\n');
    input.trim();
    if (input.startsWith("{") && input.endsWith("}")) {
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, input);

      if (error) return;
      
      String type = doc["type"] | "";
      String action = doc["action"] | "";
      
      if (type == "cmd") {
        if (action == "mqtt_status") {
          isEspOnline = doc["status"] | false;
        }
        else if (action == "sync_thresholds" || action == "sync_state") {
          float jsonKritis = doc["threshold_kritis"] | Kritis;
          float jsonAtas   = doc["threshold_atas"] | Atas;
          float jsonBawah  = doc["threshold_bawah"] | Bawah;
          
          if (Kritis != jsonKritis) { Kritis = jsonKritis; EEPROM.put(0, Kritis); }
          if (Atas != jsonAtas)     { Atas = jsonAtas; EEPROM.put(4, Atas); }
          if (Bawah != jsonBawah)   { Bawah = jsonBawah; EEPROM.put(8, Bawah); }
          
          if (doc.containsKey("auto_mode")) {
            modeManual = !(doc["auto_mode"].as<bool>());
          }
        }
        else if (action == "set_mode") {
          bool isAuto = doc["auto_mode"] | false;
          modeManual = !isAuto;
        }
        else if (action == "set_pump") {
          bool pumpOn = doc["pump_state"] | false;
          // SELALU execute relay command, regardless of modeManual
          digitalWrite(Pompa, pumpOn ? RELAY_ON : RELAY_OFF);
          sedangMenyiram = pumpOn;
          modeManual = true;  // Set to manual mode after web command
          Serial.print(F("[ARDUINO] set_pump from ESP32: "));
          Serial.println(pumpOn ? F("ON") : F("OFF"));
        }
      }
    }
  }
}

void kirimDatasensorJSON() {
  // Jangan blokir telemetry jika suhu = 0, karena pada mode simulasi nilai sensor bisa saja 0
  // dan tetap dibutuhkan untuk memicu kontrol pompa + sinkron ke web.
  if (isnan(tanah)) return;
  StaticJsonDocument<256> doc;
  
  doc["device_id"] = "ESP32_001";
  doc["sensor_source"] = "arduino_spp";
  doc["temperature"] = suhu;
  doc["humidity"] = kelembapan;
  doc["soil_moisture"] = tanah;
  
  // BACA STATUS RELAY AKTIF LOW UNTUK DIKIRIM KE ESP32
  doc["relay_state"] = (digitalRead(Pompa) == RELAY_ON);
  
  doc["led_state"] = false;
  doc["auto_mode"] = !modeManual;
  doc["mode_simulasi"] = modeSimulasi;
  doc["simulasi_waktu_valid"] = simulasiWaktuValid;
  doc["plant_phase"] = faseVegetatif ? "vegetatif" : "generatif";
  doc["threshold_kritis"] = Kritis;
  doc["threshold_atas"] = Atas;
  doc["threshold_bawah"] = Bawah;

  // Kirim hasil kalkulasi agar AI/web menerima rumus yang sama seperti Arduino
  // (score_total dipakai sebagai skor akhir; vdp sebagai komponen utama)
  doc["vpd"] = vdp;
  doc["score"] = skorTotal;
  doc["soil_score"] = skorTanah;
  doc["vdp_score"] = skorvdp;
  doc["rain_score"] = skorHujan;
  doc["duration_estimate"] = (double)durasiOff;
  
  serializeJson(doc, espSerial);
  espSerial.println();
}


void controlPompa(unsigned long waktuSekarang) {
  if (modeManual) { return; }
  
  if (hujan >= 5 || tanah >= Atas) { 
    digitalWrite(Pompa, RELAY_OFF);
    sedangMenyiram = false;
    return;
  }
  
  if (faseVegetatif) { 
    if (cekWaktuPenyiraman()) {
      if (sedangMenyiram) {
        if (waktuSekarang - waktuMulai >= durasiOn) {
          digitalWrite(Pompa, RELAY_OFF);
          sedangMenyiram = false;
          waktuAkhir = waktuSekarang;
        }
      } else {
        if (skorTotal > 55 && (waktuSekarang - waktuAkhir > durasiOff)) {
          sedangMenyiram = true;
          waktuMulai = waktuSekarang;
          digitalWrite(Pompa, RELAY_ON);
        }
      }
    } else {
      if(sedangMenyiram) {
        digitalWrite(Pompa, RELAY_OFF);
        sedangMenyiram = false;
      }
    }
  } else { 
    if (cekWaktuPenyiraman()) {
      if (sedangMenyiram) {
        if (waktuSekarang - waktuMulai >= durasiOn) {
          digitalWrite(Pompa, RELAY_OFF);
          sedangMenyiram = false;
          waktuAkhir = waktuSekarang;
        }
      } else {
        if (skorTotal > 60 && (waktuSekarang - waktuAkhir > durasiOff)) {
          sedangMenyiram = true;
          waktuMulai = waktuSekarang;
          digitalWrite(Pompa, RELAY_ON);
        }
      }
    } else {
      if(sedangMenyiram) {
        digitalWrite(Pompa, RELAY_OFF);
        sedangMenyiram = false;
      }
    }
  }
}

bool cekWaktuPenyiraman() {
  if (modeSimulasi) {
    return simulasiWaktuValid;
  }

  now = rtc.now();
  int jam = now.hour();
  int menit = now.minute();
  
  bool penyiraman1 = (jam == 6 && menit < 55);
  bool penyiraman2 = (jam == 17 && menit < 40);
  
  if (penyiraman1 || penyiraman2) { 
    return true;
  } else {
    return false;
  }
}

void debuggingNilai() {
  if (Serial.available() > 0) {
    char cmdBuf[32];
    size_t len = Serial.readBytesUntil('\n', cmdBuf, sizeof(cmdBuf) - 1);
    cmdBuf[len] = '\0';

    while(len > 0 && (cmdBuf[len-1] == '\r' || cmdBuf[len-1] == ' ' || cmdBuf[len-1] == '\n')) {
      cmdBuf[--len] = '\0';
    }

    if (strcmp(cmdBuf, "12") == 0) {
      Serial.println(F("      DEBUGGING 🔎      "));
      Serial.println(F("  "));
      Serial.print(F("  MODE SIMULASI    = ")); Serial.println(modeSimulasi ? F("AKTIF") : F("MATI"));
      Serial.print(F("  SIM WAKTU VALID  = ")); Serial.println(simulasiWaktuValid ? F("YA") : F("TIDAK"));
      Serial.println(F("_______________________"));
      Serial.print(F("  SUHU UDARA       = ")); Serial.println(suhu);
      Serial.print(F("  KELEMBAPAN UDARA = ")); Serial.println(kelembapan);
      Serial.print(F("  KELEMBAPAN TANAH = ")); Serial.println(tanah);
      Serial.println(F("_______________________"));
      Serial.print(F("  NILAI VDP        = ")); Serial.println(vdp);
      Serial.print(F("  SKOR VDP         = ")); Serial.println(skorvdp);
      Serial.println(F("_______________________"));
      if(!modeSimulasi) {
        Serial.print(F("  NILAI SOIL ASLI  = ")); Serial.println(Nsoil);
      }
      Serial.print(F("  SKOR TANAH       = ")); Serial.println(skorTanah);
      Serial.println(F("_______________________"));
      Serial.print(F("  SKOR HUJAN       = ")); Serial.println(skorHujan);
      Serial.println(F("_______________________"));
      Serial.print(F("  >>> SKOR TOTAL   = ")); Serial.println(skorTotal);
      Serial.print(F("  DURASI OFF (ms)  = ")); Serial.println(durasiOff);
      
      // CEK STATUS POMPA AKTIF LOW UNTUK DEBUG
      Serial.print(F("  STATUS POMPA     = ")); Serial.println((digitalRead(Pompa) == RELAY_ON) ? F("ON") : F("OFF"));
      Serial.println(F("________________________      🐞"));
    }
    else if (strcmp(cmdBuf, "SIM_ON") == 0) {
      modeSimulasi = true;
      Serial.println(F(">>> MODE SIMULASI AKTIF: Sensor fisik diabaikan."));
    }
    else if (strcmp(cmdBuf, "SIM_OFF") == 0) {
      modeSimulasi = false;
      Serial.println(F(">>> MODE SIMULASI NONAKTIF: Membaca sensor asli."));
    }
    else if (strcmp(cmdBuf, "SIM_PHASE_VEG") == 0 || strcmp(cmdBuf, "PHASE_VEG") == 0) {
      setFaseTanaman(true, "serial monitor", true);
    }
    else if (strcmp(cmdBuf, "SIM_PHASE_GEN") == 0 || strcmp(cmdBuf, "PHASE_GEN") == 0) {
      setFaseTanaman(false, "serial monitor", true);
    }
    else if (strcmp(cmdBuf, "TIME_ON") == 0) {
      simulasiWaktuValid = true;
      Serial.println(F(">>> SIMULASI WAKTU: Waktu dianggap VALID (Bypass RTC)."));
    }
    else if (strcmp(cmdBuf, "TIME_OFF") == 0) {
      simulasiWaktuValid = false;
      Serial.println(F(">>> SIMULASI WAKTU: Waktu dianggap TIDAK VALID."));
    }
    else if (strncmp(cmdBuf, "S=", 2) == 0) {
      tanah = atof(cmdBuf + 2);
      Serial.print(F(">>> Set Tanah (Simulasi): ")); Serial.print(tanah); Serial.println(F("%"));
    }
    else if (strncmp(cmdBuf, "T=", 2) == 0) {
      suhu = atof(cmdBuf + 2);
      Serial.print(F(">>> Set Suhu (Simulasi): ")); Serial.print(suhu); Serial.println(F("°C"));
    }
    else if (strncmp(cmdBuf, "H=", 2) == 0) {
      kelembapan = atof(cmdBuf + 2);
      Serial.print(F(">>> Set Kelembapan (Simulasi): ")); Serial.print(kelembapan); Serial.println(F("%"));
    }
    else if (strcmp(cmdBuf, "PUMP_ON") == 0 || strcmp(cmdBuf, "1") == 0 || strcmp(cmdBuf, "ON") == 0) {
      digitalWrite(Pompa, RELAY_ON);
      sedangMenyiram = true;
      modeManual = true;
      Serial.print(F(">>> PUMP ON - Pin set LOW | Read: "));
      Serial.println(digitalRead(Pompa) == RELAY_ON ? F("ON") : F("OFF"));
    }
    else if (strcmp(cmdBuf, "PUMP_OFF") == 0 || strcmp(cmdBuf, "0") == 0 || strcmp(cmdBuf, "OFF") == 0) {
      digitalWrite(Pompa, RELAY_OFF);
      sedangMenyiram = false;
      modeManual = true;
      Serial.print(F(">>> PUMP OFF - Pin set HIGH | Read: "));
      Serial.println(digitalRead(Pompa) == RELAY_ON ? F("ON") : F("OFF"));
    }
  }
}
