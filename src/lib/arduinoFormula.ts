export const ARDUINO_FORMULA_REFERENCE = `
RUMUS ARDUINO NANO YANG WAJIB DIIKUTI:
1) Soil moisture percent:
   moisture = constrain(mapFloat(rawSoil, SOIL_RAW_DRY, SOIL_RAW_WET, 0, 100), 0, 100)
   dengan kalibrasi default: SOIL_RAW_DRY = 830 dan SOIL_RAW_WET = 350

2) Vapor Pressure Deficit (VPD):
   svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3))
   avp = svp * (kelembapan_udara / 100)
   vpd = svp - avp

3) Soil score:
   soilRange = atas - kritis
   skortanah = constrain(((atas - k_tanah) * 50) / soilRange, 0, 50)

4) VPD score:
   skorvdp = constrain(mapFloat(vpd, 0.4, 2.0, 0, 30), 0, 30)

5) Total score:
   skortotal = skortanah + skorvdp - skorhujan

6) Estimasi durasi siram:
   durasi_total = round(max(0, 5 * (atas - k_tanah) / 100 * max(vpd, 0.5)))

7) Logika relay:
   ON jika k_tanah <= kritis atau skortotal >= 60
   OFF jika k_tanah >= atas atau hujan >= 5 atau suhu <= 20

Saat menjawab, gunakan rumus di atas secara konsisten dan jangan mengganti konstanta tanpa menyebutkan bahwa itu adalah asumsi kalibrasi baru.
`.trim();

export function getArduinoFormulaReference(): string {
  return ARDUINO_FORMULA_REFERENCE;
}
