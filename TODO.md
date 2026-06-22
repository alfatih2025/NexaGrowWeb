# TODO - Fix build TypeScript errors

- [x] Missing exports removed by removing unused calls/imports.

- [ ] Fix `score` type mismatch:
  - [ ] Add `score?: number | null` to `SensorData` in `src/hooks/useSensorData.ts`.
  - [ ] Add `score?: number | null` to `MqttSensorSnapshot` in `src/services/mqtt.ts`.
  - [ ] Update MQTT parsing/merge logic to populate `score` from incoming payload if available.
- [ ] Update UI fallbacks in `src/App.tsx` and any other usage so TypeScript matches.
- [ ] Run `npm run build` to confirm no TS errors.

