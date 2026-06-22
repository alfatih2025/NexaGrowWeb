# Sprout v2 - Smart Farm IoT Dashboard

A modern web application for ESP32 IoT agriculture monitoring and control.

## Features

- **Real-time Monitoring**: Live sensor data from ESP32 (temperature, humidity, pH, turbidity, soil moisture)
- **Weather Integration**: BMKG API integration for weather forecasts
- **AI Chatbot**: Smart Farm Assistant powered by OpenRouter AI
- **Device Control**: Remote control of pumps and feeders
- **Data Analytics**: Historical data visualization with charts
- **Alert System**: Threshold-based notifications
- **Export Data**: CSV export functionality

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **APIs**: BMKG Weather API, OpenRouter AI

## Project Structure

```
src/
  components/     # UI Components
  pages/          # Page components
  hooks/          # Custom React hooks
  lib/            # Utilities
  App.tsx         # Main app
  index.css       # Global styles

api/              # Vercel API routes
  sensor.js       # Sensor data endpoints
  device-status.js # Device online status
  control.js      # Device control endpoints
  weather.js      # BMKG weather integration
  chat.js         # AI chatbot endpoint
  alerts.js       # Alert management
  settings.js     # User settings
  logs.js         # Activity logs
  export.js       # Data export
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sensor` | GET/POST | Sensor data |
| `/api/device-status` | GET | Device online status |
| `/api/control` | GET/POST | Device control commands |
| `/api/weather` | GET | Weather data from BMKG |
| `/api/chat` | GET/POST | AI chat messages |
| `/api/alerts` | GET/POST | Alerts and notifications |
| `/api/settings` | GET/PUT | User settings |
| `/api/logs` | GET | Activity logs |
| `/api/export` | GET | Export data as CSV |

## ESP32 Data Format

```json
{
  "device_id": "ESP32_001",
  "temperature": 28.5,
  "humidity": 75,
  "ph": 6.8,
  "turbidity": 15,
  "soil_moisture": 65,
  "pump_status": false,
  "feeder_status": false,
  "wifi_status": "connected"
}
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Deploy to Vercel:
```bash
vercel --prod
```

## Environment Variables

```
# Frontend (Vite)
VITE_BROKER_URL=wss://your-broker.example.com:8884/mqtt
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=
VITE_API_AUTH_TOKEN=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENROUTER_API_KEY=

# Server/Deploy
API_AUTH_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini

# ESP32 PlatformIO / system env
WIFI_SSID=
WIFI_PASS=
MQTT_SERVER=
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

## License

MIT License - 2025 Smart Farm Project
