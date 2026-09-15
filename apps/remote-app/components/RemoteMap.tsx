'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { RemoteMapProps, MapMarker } from '../types';
import { emitToast, emitMapSelect } from '../lib/events';
import { SAMPLE_MARKERS } from '../lib/mapMarkers';
import { remoteLog } from '../lib/logger';


export const RemoteMap: React.FC<RemoteMapProps> = ({
  zoom = 2,
  selectedCity,
  onMarkerClick,
  session,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  // A cidade vinda da URL já chega selecionada no HTML do servidor.
  const initialMarker = SAMPLE_MARKERS.find((m) => m.id === selectedCity) ?? null;
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(initialMarker);
  const lat = initialMarker?.lat ?? -23.5505;
  const lng = initialMarker?.lng ?? -46.6333;
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      const maplibre = await import('maplibre-gl');
      if (isCancelled || !mapContainerRef.current) return;

      const map = new maplibre.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap Contributors',
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [lng, lat],
        zoom: initialMarker ? 6 : zoom,
      });

      map.addControl(new maplibre.NavigationControl(), 'top-right');

      map.on('load', () => {
        if (isCancelled) return;
        setIsMapLoaded(true);
        remoteLog.client('MAPLIBRE_ENGINE_LOADED', { markersCount: SAMPLE_MARKERS.length });

        SAMPLE_MARKERS.forEach((marker) => {
          const el = document.createElement('div');
          el.className = `map-custom-pin pin-${marker.status}`;
          el.title = marker.name;

          const popup = new maplibre.Popup({ offset: 25 }).setHTML(`
            <div style="color: #0f172a; font-family: sans-serif; padding: 4px;">
              <strong style="font-size: 13px;">${marker.name}</strong>
              <p style="font-size: 11px; margin-top: 4px; color: #475569;">${marker.description}</p>
            </div>
          `);

          new maplibre.Marker({ element: el })
            .setLngLat([marker.lng, marker.lat])
            .setPopup(popup)
            .addTo(map);

          el.addEventListener('click', () => {
            setSelectedMarker(marker);
            onMarkerClick?.(marker);
            remoteLog.client('MAP_MARKER_CLICKED', {
              id: marker.id,
              name: marker.name,
              coordinates: [marker.lat, marker.lng],
            });
            emitMapSelect(marker);
            emitToast(
              'Map Location Selected',
              `${marker.name} (${marker.status.toUpperCase()}) - ${marker.description}`,
              marker.status === 'warning' ? 'warning' : 'info'
            );
          });
        });
      });

      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      isCancelled = true;
      mapInstanceRef.current?.remove();
    };
  }, []);

  const handleFlyTo = (marker: MapMarker) => {
    setSelectedMarker(marker);
    remoteLog.client('MAP_FLY_TO', { id: marker.id, name: marker.name });
    mapInstanceRef.current?.flyTo({ center: [marker.lng, marker.lat], zoom: 8, speed: 1.5 });
    onMarkerClick?.(marker);
    emitMapSelect(marker);
    emitToast('Map Navigated', `Flying to ${marker.name}`, 'info');
  };

  return (
    <div className="federated-card map-card">
      <header className="federated-card-header">
        <span className="badge">Remote MapLibre GL</span>
        <h3 className="card-title">Geographic Fleet Infrastructure</h3>
        {session && <span className="session-tag">Operator: {session.userName}</span>}
      </header>

      <div className="card-body">
        <div className="map-quick-bar">
          <span className="quick-bar-label">Quick Jump:</span>
          {SAMPLE_MARKERS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`city-pill ${selectedMarker?.id === m.id ? 'active' : ''}`}
              onClick={() => handleFlyTo(m)}
            >
              {m.name.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="map-viewport-wrapper">
          <div ref={mapContainerRef} className="map-container" />
          {!isMapLoaded && (
            <div className="map-loading-overlay">
              <p>Initializing MapLibre GL WebGL Engine...</p>
            </div>
          )}
        </div>

        {selectedMarker && (
          <div className="selected-marker-banner">
            <h4>{selectedMarker.name}</h4>
            <p>{selectedMarker.description}</p>
            <span className="mono">
              Coordinates: {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemoteMap;
