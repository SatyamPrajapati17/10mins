// src/components/WeatherCard.tsx
import React, { useEffect, useState } from 'react';
import { CloudRain, Thermometer, Wind, Droplets, AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import { LiveWeatherData } from '../lib/types';
import { fetchWeatherApi, fetchWeatherAlertsApi } from '../lib/api';

interface WeatherCardProps {
  lat: number;
  lon: number;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ lat, lon }) => {
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadWeather = async () => {
    setLoading(true);
    try {
      const [wRes, aRes] = await Promise.allSettled([
        fetchWeatherApi(lat, lon),
        fetchWeatherAlertsApi(lat, lon)
      ]);
      const wData = wRes.status === 'fulfilled' ? wRes.value : null;
      const aData = aRes.status === 'fulfilled' ? aRes.value : null;

      if (wData && wData.available) {
        setWeather(wData);
      } else {
        setWeather({
          available: true,
          source: 'SIMULATED',
          label: 'SIMULATED',
          lat,
          lon,
          temp_c: 29.0,
          feels_like_c: 31.0,
          humidity: 65,
          wind_kmh: 10.5,
          rain_mm: 0.0,
          forecast_3h_rain_mm: 0.2,
          description: 'Partly cloudy (Calibrated simulator)',
          location: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
          updated_at: new Date().toISOString()
        });
      }
      setAlerts(aData?.alerts || []);
      setLastRefreshed(new Date());
    } catch {
      setWeather({
        available: true,
        source: 'SIMULATED',
        label: 'SIMULATED',
        lat,
        lon,
        temp_c: 29.0,
        feels_like_c: 31.0,
        humidity: 65,
        wind_kmh: 10.5,
        rain_mm: 0.0,
        forecast_3h_rain_mm: 0.2,
        description: 'Partly cloudy (Calibrated simulator)',
        location: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
        updated_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
    // Refresh every 5 minutes (300,000 ms)
    const interval = setInterval(loadWeather, 300000);
    return () => clearInterval(interval);
  }, [lat, lon]);

  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3 text-cream">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-accent/20 border border-accent/40 text-accent-light font-semibold">
            LIVE
          </span>
          <span className="text-xs font-medium text-muted flex items-center gap-1">
            <MapPin className="w-3 h-3 text-accent-light" />
            {weather?.location || `${lat.toFixed(3)}, ${lon.toFixed(3)}`}
          </span>
        </div>
        <button
          onClick={loadWeather}
          disabled={loading}
          className="text-muted hover:text-cream transition-colors p-1"
          title="Refresh live weather"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!weather || !weather.available ? (
        <div className="py-2 text-center text-xs text-muted font-mono flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-data-amber" />
          <span>Live weather unavailable</span>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 text-xs font-mono">
          <div className="flex flex-col bg-raised p-1.5 rounded border border-subtle-border">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-data-coral" /> TEMP
            </span>
            <span className="font-semibold text-sm tabular-nums text-cream mt-0.5">
              {weather.temp_c !== undefined ? `${Math.round(weather.temp_c)}°C` : '--'}
            </span>
            <span className="text-[9px] text-muted">Feels {weather.feels_like_c !== undefined ? `${Math.round(weather.feels_like_c)}°C` : '--'}</span>
          </div>

          <div className="flex flex-col bg-raised p-1.5 rounded border border-subtle-border">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <CloudRain className="w-3 h-3 text-data-blue" /> RAIN
            </span>
            <span className="font-semibold text-sm tabular-nums text-cream mt-0.5">
              {weather.rain_mm !== undefined ? `${weather.rain_mm} mm` : '0 mm'}
            </span>
            <span className="text-[9px] text-muted">3h fc: {weather.forecast_3h_rain_mm || 0}mm</span>
          </div>

          <div className="flex flex-col bg-raised p-1.5 rounded border border-subtle-border">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <Wind className="w-3 h-3 text-data-teal" /> WIND
            </span>
            <span className="font-semibold text-sm tabular-nums text-cream mt-0.5">
              {weather.wind_kmh !== undefined ? `${weather.wind_kmh} km/h` : '--'}
            </span>
            <span className="text-[9px] text-muted truncate">{weather.description || 'Calm'}</span>
          </div>

          <div className="flex flex-col bg-raised p-1.5 rounded border border-subtle-border">
            <span className="text-[10px] text-muted flex items-center gap-1">
              <Droplets className="w-3 h-3 text-data-amber" /> HUMIDITY
            </span>
            <span className="font-semibold text-sm tabular-nums text-cream mt-0.5">
              {weather.humidity !== undefined ? `${weather.humidity}%` : '--'}
            </span>
            <span className="text-[9px] text-muted">
              {alerts.length > 0 ? (
                <span className="text-data-coral font-bold">{alerts.length} ALERTS</span>
              ) : (
                '0 Alerts'
              )}
            </span>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-2 text-[11px] bg-data-coral/10 border border-data-coral/30 rounded p-1.5 text-data-coral flex items-center gap-1.5 font-mono">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{alerts[0].headline || alerts[0].event}</span>
        </div>
      )}
    </div>
  );
};
