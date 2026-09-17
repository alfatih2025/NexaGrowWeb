import { describe, it, expect } from 'vitest';
import { ARDUINO_FORMULA_REFERENCE, getArduinoFormulaReference } from './arduinoFormula';

describe('arduinoFormula', () => {
  it('exposes a trimmed reference string', () => {
    expect(ARDUINO_FORMULA_REFERENCE).toBe(ARDUINO_FORMULA_REFERENCE.trim());
    expect(ARDUINO_FORMULA_REFERENCE.length).toBeGreaterThan(0);
  });

  it('contains the key formula sections', () => {
    expect(ARDUINO_FORMULA_REFERENCE).toContain('Soil moisture percent');
    expect(ARDUINO_FORMULA_REFERENCE).toContain('Vapor Pressure Deficit (VPD)');
    expect(ARDUINO_FORMULA_REFERENCE).toContain('SOIL_RAW_DRY = 830');
    expect(ARDUINO_FORMULA_REFERENCE).toContain('SOIL_RAW_WET = 350');
    expect(ARDUINO_FORMULA_REFERENCE).toContain('Logika relay');
  });

  it('getArduinoFormulaReference returns the same reference', () => {
    expect(getArduinoFormulaReference()).toBe(ARDUINO_FORMULA_REFERENCE);
  });
});
