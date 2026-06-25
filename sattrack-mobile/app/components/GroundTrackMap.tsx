import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../hooks/useSatellites';

interface GroundTrackMapProps {
  tleLine1: string;
  tleLine2: string;
  satName: string;
  observerLat?: number | null;
  observerLon?: number | null;
  onCoordinatesUpdate?: (lat: number, lon: number, alt: number, vel: number) => void;
}

export const GroundTrackMap: React.FC<GroundTrackMapProps> = ({
  tleLine1,
  tleLine2,
  satName,
  observerLat,
  observerLon,
  onCoordinatesUpdate
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="${API_BASE_URL}/static/leaflet.css" />
  <script src="${API_BASE_URL}/static/leaflet.js"></script>
  <script src="${API_BASE_URL}/static/satellite.min.js"></script>
  <script src="${API_BASE_URL}/static/L.Terminator.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #121212;
      font-family: 'Inter', sans-serif;
    }
    #map {
      width: 100vw;
      height: 100vh;
      background-color: #121212;
    }
    .leaflet-bar {
      border: 1px solid rgba(0, 0, 0, 0.15) !important;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25) !important;
      border-radius: 6px !important;
      overflow: hidden;
    }
    .leaflet-bar a {
      background-color: #ffffff !important;
      color: #000000 !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }
    .leaflet-bar a:hover {
      background-color: #f7fafc !important;
    }
    .fullscreen-control {
      background-color: #ffffff !important;
      border: 1px solid rgba(0, 0, 0, 0.15) !important;
      border-radius: 6px;
      cursor: pointer;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    }
    .fullscreen-control svg {
      fill: #4a5568;
      width: 16px;
      height: 16px;
    }
    .sat-marker-container {
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .sat-pulse {
      position: absolute;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(229, 231, 235, 0.5);
      animation: pulse 2s infinite ease-out;
      pointer-events: none;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2.0); opacity: 0; }
    }
    .leaflet-tooltip-custom {
      background: rgba(20, 20, 20, 0.9) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      color: #ffffff !important;
      border-radius: 4px !important;
      font-weight: 600 !important;
      font-size: 10px !important;
      padding: 2px 6px !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5) !important;
    }
    .leaflet-control-layers {
      background: #ffffff !important;
      color: #000000 !important;
      border: 1px solid rgba(0, 0, 0, 0.15) !important;
      border-radius: 8px !important;
      font-family: 'Inter', sans-serif !important;
    }
    .leaflet-control-layers-toggle {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'%3E%3C/polygon%3E%3Cpolyline points='2 17 12 22 22 17'%3E%3C/polyline%3E%3Cpolyline points='2 12 12 17 22 12'%3E%3C/polyline%3E%3C/svg%3E") !important;
      background-size: 20px 20px;
      background-position: center;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    const TLE_LINE_1 = ${JSON.stringify(tleLine1)};
    const TLE_LINE_2 = ${JSON.stringify(tleLine2)};
    const SAT_NAME = ${JSON.stringify(satName)};
    const OBSERVER_LAT = ${JSON.stringify(observerLat)};
    const OBSERVER_LON = ${JSON.stringify(observerLon)};

    const line1 = TLE_LINE_1;
    const line2 = TLE_LINE_2;
    const name = SAT_NAME;

    const map = L.map('map', {
      zoomControl: true,
      minZoom: 1,
      maxZoom: 10,
      worldCopyJump: true,
      attributionControl: false
    }).setView([0, 0], 2);

    // Standard high-contrast OpenStreetMap light tiles matching user screenshot
    const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Add scale bar in the bottom left matching user screenshot
    L.control.scale({ position: 'bottomleft', metric: true, imperial: true }).addTo(map);

    const satrec = satellite.twoline2satrec(line1, line2);

    const orbitLayer = L.layerGroup().addTo(map);
    const footprintLayer = L.layerGroup().addTo(map);
    const terminatorLayer = L.layerGroup().addTo(map);
    const obsLayer = L.layerGroup().addTo(map);
    const stationsLayer = L.layerGroup().addTo(map);
    let satMarker = null;

    // Observer location and visibility circle will be drawn dynamically in update()

    function propagate(date) {
      try {
        satrec.error = 0;
        const pVal = satellite.propagate(satrec, date);
        if (!pVal || !pVal.position || !pVal.velocity) return null;
        
        const gmst = satellite.gstime(date);
        const posGd = satellite.eciToGeodetic(pVal.position, gmst);
        
        const lat = satellite.degreesLat(posGd.latitude);
        const lon = satellite.degreesLong(posGd.longitude);
        const alt = posGd.height;
        
        const vx = pVal.velocity.x;
        const vy = pVal.velocity.y;
        const vz = pVal.velocity.z;
        const vel = Math.sqrt(vx*vx + vy*vy + vz*vz);
        
        return { lat, lon, alt, vel };
      } catch (e) {
        return null;
      }
    }

    function buildSegments(pts) {
      const segs = [];
      let cur = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (cur.length > 0) {
          const last = cur[cur.length - 1];
          if (Math.abs(p.lon - last[1]) > 180) {
            segs.push(cur);
            cur = [];
          }
        }
        cur.push([p.lat, p.lon]);
      }
      if (cur.length > 0) segs.push(cur);
      return segs;
    }

    function getFootprintRadiusMeters(altKm) {
      const Re = 6371;
      const eps = 10 * Math.PI / 180;
      const rRatio = Re / (Re + altKm);
      const val = rRatio * Math.cos(eps);
      if (val >= 1.0) return 0;
      const theta = Math.acos(val) - eps;
      return Re * theta * 1000;
    }

    let dayNightPolygon = null;
    function updateTerminator(date) {
      terminatorLayer.clearLayers();
      try {
        dayNightPolygon = L.terminator({
          time: date.toISOString(),
          color: '#334155',
          opacity: 0.35,
          fillColor: '#334155',
          fillOpacity: 0.35,
          weight: 0
        }).addTo(terminatorLayer);
      } catch (e) {
        // ignore
      }
    }

    const groundStations = [];
    function drawGroundStations() {
      stationsLayer.clearLayers();
      groundStations.forEach(gs => {
        L.circleMarker([gs.lat, gs.lon], {
          radius: 6,
          color: '#4A90D9',
          fillColor: '#000',
          fillOpacity: 0.8,
          weight: 2
        }).bindTooltip(gs.name, {
          permanent: false,
          direction: 'top',
          className: 'leaflet-tooltip-custom'
        }).addTo(stationsLayer);
      });
    }
    drawGroundStations();

    const fsControl = L.control({ position: 'topright' });
    fsControl.onAdd = function() {
      const btn = L.DomUtil.create('button', 'fullscreen-control');
      btn.title = "Toggle Fullscreen";
      btn.innerHTML = 
        '<svg viewBox="0 0 24 24">' +
          '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>' +
        '</svg>';
      btn.onclick = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'TOGGLE_FULLSCREEN'
        }));
      };
      return btn;
    };
    fsControl.addTo(map);

    let lastRenderedTime = 0;

    function update() {
      const baseTime = new Date();
      const tState = propagate(baseTime);

      if (!tState) return;

      if (!satMarker) {
        const satIcon = L.divIcon({
          html: 
            '<div class="sat-marker-container">' +
              '<div class="sat-pulse"></div>' +
              '<svg viewBox="0 0 24 24" width="28" height="28" fill="#4B5563">' +
                '<path d="M5 2C3.34 2 2 3.34 2 5v2c0 1.66 1.34 3 3 3h2v2H5c-1.66 0-3 1.34-3 3v2c0 1.66 1.34 3 3 3h2c1.66 0 3-1.34 3-3v-2h4v2c0 1.66 1.34 3 3 3h2c1.66 0 3-1.34 3-3v-2c0-1.66-1.34-3-3-3h-2v-2h2c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3h-2c-1.66 0-3 1.34-3 3v2h-4V5c0-1.66-1.34-3-3-3H5zm0 2h2v4H5c-.55 0-1-.45-1-1V5c0-.55.45-1 1-1zm12 0h2c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2V4zm-6 3.5c2.48 0 4.5 2.02 4.5 4.5s-2.02 4.5-4.5 4.5-4.5-2.02-4.5-4.5 2.02-4.5 4.5-4.5zm0 1.5c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>' +
              '</svg>' +
            '</div>',
          className: 'leaflet-marker-sat',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        satMarker = L.marker([tState.lat, tState.lon], { icon: satIcon })
          .bindTooltip(name, {
            permanent: true,
            direction: 'right',
            className: 'leaflet-tooltip-custom'
          })
          .addTo(map);
        
        map.panTo([tState.lat, tState.lon]);
      } else {
        satMarker.setLatLng([tState.lat, tState.lon]);
        if (Date.now() - lastRenderedTime > 10000) {
          map.panTo([tState.lat, tState.lon]);
        }
      }

      footprintLayer.clearLayers();
      const radiusMeters = getFootprintRadiusMeters(tState.alt);
      L.circle([tState.lat, tState.lon], {
        radius: radiusMeters,
        color: 'rgba(59, 130, 246, 0.4)',
        fillColor: 'rgba(59, 130, 246, 0.08)',
        weight: 1.5
      }).addTo(footprintLayer);

      // Draw observer location and dynamic horizon visibility circle
      obsLayer.clearLayers();
      if (OBSERVER_LAT !== null && OBSERVER_LON !== null) {
        L.circleMarker([OBSERVER_LAT, OBSERVER_LON], {
          radius: 6,
          color: '#FF0000',
          fillColor: '#FF0000',
          fillOpacity: 1.0,
          weight: 1
        }).bindTooltip("Observer", {
          permanent: false,
          direction: 'top',
          className: 'leaflet-tooltip-custom'
        }).addTo(obsLayer);

        if (radiusMeters > 0) {
          L.circle([OBSERVER_LAT, OBSERVER_LON], {
            radius: radiusMeters,
            color: 'rgba(255, 0, 0, 0.35)',
            fillColor: 'rgba(255, 0, 0, 0.04)',
            weight: 1.5,
            dashArray: '4, 4'
          }).bindTooltip("Observer Visibility Range (" + Math.round(radiusMeters/1000).toLocaleString() + " km)", {
            permanent: false,
            direction: 'top',
            className: 'leaflet-tooltip-custom'
          }).addTo(obsLayer);
        }
      }

      orbitLayer.clearLayers();
      const orbitPts = [];
      const periodMin = (2 * Math.PI) / satrec.no;
      const step = Math.max(1, Math.round(periodMin / 180));
      const halfPeriod = periodMin / 2;

      // Calculate continuous entire orbit path based on satellite's specific orbital period
      for (let offset = -halfPeriod; offset <= halfPeriod; offset += step) {
        const timeOffset = new Date(baseTime.getTime() + offset * 60 * 1000);
        const state = propagate(timeOffset);
        if (state) orbitPts.push(state);
      }

      // Draw continuous orbit track in bright solid yellow with dark outlines
      buildSegments(orbitPts).forEach(seg => {
        L.polyline(seg, { color: '#000000', weight: 5.0, opacity: 0.35 }).addTo(orbitLayer);
        L.polyline(seg, { color: '#FFFF00', weight: 2.5, opacity: 1.0 }).addTo(orbitLayer);
      });

      updateTerminator(baseTime);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'COORDINATES_UPDATE',
        lat: tState.lat,
        lon: tState.lon,
        alt: tState.alt,
        vel: tState.vel
      }));

      lastRenderedTime = Date.now();
    }

    const overlayMaps = {
      "Current Position": footprintLayer,
      "Coverage Footprint": footprintLayer,
      "Orbit Track": orbitLayer,
      "Day/Night Terminator": terminatorLayer,
      "Observer Location": obsLayer,
      "Ground Stations": stationsLayer
    };
    L.control.layers(null, overlayMaps, { collapsed: true, position: 'topright' }).addTo(map);

    update();

    setInterval(update, 5000);
  </script>
</body>
</html>
  `;

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'COORDINATES_UPDATE' && onCoordinatesUpdate) {
        onCoordinatesUpdate(data.lat, data.lon, data.alt, data.vel);
      } else if (data.type === 'TOGGLE_FULLSCREEN') {
        setIsFullscreen(!isFullscreen);
      }
    } catch (e) {
      console.warn('Error parsing message from WebView:', e);
    }
  };

  const renderWebView = () => (
    <WebView
      originWhitelist={['*']}
      source={{ html: htmlContent }}
      style={styles.webview}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      onMessage={onMessage}
      startInLoadingState={true}
      renderLoading={() => (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      {renderWebView()}
      
      <Modal
        visible={isFullscreen}
        animationType="fade"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.modalContainer}>
          {renderWebView()}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsFullscreen(false)}
          >
            <Ionicons name="close-circle" size={38} color="#000000" style={styles.closeIconShadow} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 420,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#121212',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  webview: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 99999,
  },
  closeIconShadow: {
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  }
});
