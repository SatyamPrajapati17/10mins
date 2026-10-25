// src/components/LiveMap.tsx
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Radio, Layers, AlertTriangle } from 'lucide-react';
import { HypothesisKey } from '../lib/types';

interface GatewayMapInfo {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lon: number;
  status: 'normal' | 'anom' | 'failure';
}

interface LiveMapProps {
  currentBelief: Record<HypothesisKey, number>;
  onOpenSourceHealth: (gatewayId?: string) => void;
  onLocationTracked?: (lat: number, lon: number) => void;
}

const GATEWAYS_DATA: GatewayMapInfo[] = [
  { id: 'gateway_G11', name: 'Gateway G11', zone: 'Zone A (Central)', lat: 19.0760, lon: 72.8777, status: 'normal' },
  { id: 'gateway_G12', name: 'Gateway G12', zone: 'Zone B (East Basin)', lat: 19.0850, lon: 72.8900, status: 'anom' },
  { id: 'gateway_G13', name: 'Gateway G13', zone: 'Zone C (South Harbor)', lat: 19.0650, lon: 72.8650, status: 'normal' },
  { id: 'gateway_G14', name: 'Gateway G14', zone: 'Zone D (North Ridge)', lat: 19.0950, lon: 72.8550, status: 'normal' },
];

// Helper component to center map when user location is found
const RecenterMap: React.FC<{ coords: [number, number] }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, 13);
  }, [coords, map]);
  return null;
};

// Custom Leaflet DivIcons using inline SVG for crisp rendering without 404 image errors
function createGatewayIcon(color: string, label: string) {
  return L.divIcon({
    className: 'custom-gateway-icon',
    html: `
      <div style="background-color: #211A15; border: 2px solid ${color}; color: #F5EFE8; border-radius: 6px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.6); white-space: nowrap;">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${color};"></span>
        <span>${label}</span>
      </div>
    `,
    iconSize: [80, 24],
    iconAnchor: [40, 12],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: 'custom-user-icon',
    html: `
      <div style="position: relative; width: 18px; height: 18px;">
        <div style="position: absolute; width: 18px; height: 18px; border-radius: 50%; background-color: #2DD4BF; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background-color: #2DD4BF; border: 2px solid #0D0B0A;"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export const LiveMap: React.FC<LiveMapProps> = ({ currentBelief, onOpenSourceHealth, onLocationTracked }) => {
  // Default coordinates: Mumbai (19.076, 72.8777)
  const defaultCoords: [number, number] = [19.0760, 72.8777];
  const [userLocation, setUserLocation] = useState<[number, number]>(defaultCoords);
  const [accuracy, setAccuracy] = useState<number>(150);
  const [isLiveGps, setIsLiveGps] = useState<boolean>(false);

  // Setup geolocation watchPosition on load
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setUserLocation([lat, lon]);
          setAccuracy(pos.coords.accuracy || 100);
          setIsLiveGps(true);
          if (onLocationTracked) {
            onLocationTracked(lat, lon);
          }
        },
        (err) => {
          console.warn('Geolocation denied or unavailable, using Mumbai default:', err.message);
          setUserLocation(defaultCoords);
          setIsLiveGps(false);
          if (onLocationTracked) {
            onLocationTracked(defaultCoords[0], defaultCoords[1]);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      if (onLocationTracked) {
        onLocationTracked(defaultCoords[0], defaultCoords[1]);
      }
    }
  }, []);

  // Determine dominant hypothesis color for incident zone highlights
  const getHypothesisColor = () => {
    if (currentBelief.cascade > 0.40) return '#FF6B5E';
    if (currentBelief.isolated > 0.40) return '#F2B84B';
    if (currentBelief.sensor_failure > 0.40) return '#B48CF2';
    return '#7C8DA6';
  };

  const zoneColor = getHypothesisColor();

  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3 text-cream flex flex-col h-[340px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-accent-light" />
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-cream">
            OPERATIONAL SPATIAL RADAR (OSM TILES)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isLiveGps ? 'bg-data-teal animate-pulse' : 'bg-data-amber'}`} />
            {isLiveGps ? 'GPS TRACKING' : 'MUMBAI BASE'}
          </span>
          <button
            onClick={() => onOpenSourceHealth()}
            className="text-accent-light hover:underline flex items-center gap-1"
          >
            Gateways Drawer →
          </button>
        </div>
      </div>

      {/* Leaflet Map Container */}
      <div className="flex-1 w-full rounded overflow-hidden border border-subtle-border relative">
        <MapContainer
          center={userLocation}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          <RecenterMap coords={userLocation} />

          {/* OpenStreetMap standard tiles (no API key needed) */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* User Location Marker & Accuracy Circle */}
          <Marker position={userLocation} icon={createUserIcon()}>
            <Popup>
              <div className="text-xs font-mono">
                <span className="font-bold text-cream block mb-1">
                  {isLiveGps ? 'YOUR CURRENT POSITION' : 'OPERATIONS HQ (MUMBAI)'}
                </span>
                <span className="text-muted block">
                  {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                </span>
                <span className="text-[10px] text-data-teal block mt-1">Accuracy: ±{Math.round(accuracy)}m</span>
              </div>
            </Popup>
          </Marker>
          <Circle
            center={userLocation}
            radius={accuracy}
            pathOptions={{ color: '#2DD4BF', fillColor: '#2DD4BF', fillOpacity: 0.1, weight: 1 }}
          />

          {/* Incident Zone Circles colored by hypothesis */}
          <Circle
            center={[19.0850, 72.8900]} // Zone B basin
            radius={1200}
            pathOptions={{ color: zoneColor, fillColor: zoneColor, fillOpacity: 0.15, weight: 1.5, dashArray: '4, 4' }}
          />

          {/* Sensor Gateways Markers */}
          {GATEWAYS_DATA.map((gw) => {
            const gwColor = gw.id === 'gateway_G12' && currentBelief.sensor_failure > 0.35
              ? '#B48CF2'
              : currentBelief.cascade > 0.40
              ? '#FF6B5E'
              : '#8B5E3C';

            return (
              <Marker
                key={gw.id}
                position={[gw.lat, gw.lon]}
                icon={createGatewayIcon(gwColor, gw.id.replace('gateway_', ''))}
                eventHandlers={{
                  click: () => onOpenSourceHealth(gw.id),
                }}
              >
                <Popup>
                  <div className="text-xs font-mono">
                    <span className="font-bold text-cream block mb-0.5">{gw.name}</span>
                    <span className="text-muted block mb-1">{gw.zone}</span>
                    <span className="text-[10px] text-accent-light block">
                      10 sensors reporting (intra-corr ρ=0.8)
                    </span>
                    <button
                      onClick={() => onOpenSourceHealth(gw.id)}
                      className="mt-2 text-[10px] px-2 py-1 bg-accent/20 border border-accent/40 rounded text-cream hover:bg-accent/40 block w-full text-center"
                    >
                      Open Source Health →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Map Legend */}
        <div className="absolute bottom-2 left-2 z-[400] bg-surface/90 backdrop-blur border border-subtle-border rounded p-2 text-[10px] font-mono text-muted space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-data-teal" />
            <span>Tracked Location</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: zoneColor }} />
            <span>Incident Zone (Colored by Hypothesis)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-[#8B5E3C] bg-raised" />
            <span>Telemetry Gateway (Click for Health)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
