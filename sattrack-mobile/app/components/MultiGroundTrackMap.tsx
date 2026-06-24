import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface SatelliteItem {
  name: string;
  tle_line1: string;
  tle_line2: string;
  visible: boolean;
}

interface MultiGroundTrackMapProps {
  satellites: SatelliteItem[];
  observerLat?: number | null;
  observerLon?: number | null;
}

export const MultiGroundTrackMap: React.FC<MultiGroundTrackMapProps> = ({
  satellites,
  observerLat,
  observerLon,
}) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/satellite.js@4.0.0/dist/satellite.min.js"></script>
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
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    const satellitesData = ${JSON.stringify(satellites)};
    const OBSERVER_LAT = ${JSON.stringify(observerLat)};
    const OBSERVER_LON = ${JSON.stringify(observerLon)};

    const map = L.map('map', {
      zoomControl: true,
      minZoom: 1,
      maxZoom: 10,
      worldCopyJump: true,
      attributionControl: false
    }).setView(OBSERVER_LAT && OBSERVER_LON ? [OBSERVER_LAT, OBSERVER_LON] : [0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Draw observer location
    if (OBSERVER_LAT !== null && OBSERVER_LON !== null) {
      L.circleMarker([OBSERVER_LAT, OBSERVER_LON], {
        radius: 6,
        color: '#FF0000',
        fillColor: '#FF0000',
        fillOpacity: 1.0,
        weight: 1
      }).bindTooltip("My Location", {
        permanent: true,
        direction: 'top',
        className: 'leaflet-tooltip-custom'
      }).addTo(map);
    }

    const satrecMap = {};
    const satMarkers = {};
    let activeFootprint = null;

    satellitesData.forEach(sat => {
      if (sat.tle_line1 && sat.tle_line2) {
        try {
          const satrec = satellite.twoline2satrec(sat.tle_line1, sat.tle_line2);
          satrecMap[sat.name] = {
            satrec: satrec,
            visible: sat.visible
          };
        } catch (e) {
          // ignore TLE parsing errors
        }
      }
    });

    function getFootprintRadiusMeters(altKm) {
      const Re = 6371;
      const eps = 10 * Math.PI / 180;
      const rRatio = Re / (Re + altKm);
      const val = rRatio * Math.cos(eps);
      if (val >= 1.0) return 0;
      const theta = Math.acos(val) - eps;
      return Re * theta * 1000;
    }

    function update() {
      const now = new Date();
      const gmst = satellite.gstime(now);

      Object.keys(satrecMap).forEach(name => {
        const item = satrecMap[name];
        try {
          const pVal = satellite.propagate(item.satrec, now);
          if (!pVal || !pVal.position) return;

          const posGd = satellite.eciToGeodetic(pVal.position, gmst);
          const lat = satellite.degreesLat(posGd.latitude);
          const lon = satellite.degreesLong(posGd.longitude);
          const alt = posGd.height;

          // Color marker green if visible, blue/gray if not visible
          const markerColor = item.visible ? '#10B981' : '#4B5563';
          const satIcon = L.divIcon({
            html: 
              '<svg viewBox="0 0 24 24" width="20" height="20">' +
                '<circle cx="10" cy="10" r="8" fill="' + markerColor + '" stroke="#FFFFFF" stroke-width="1.5" />' +
                (item.visible ? '<circle cx="10" cy="10" r="4" fill="#FFFFFF" />' : '') +
              '</svg>',
            className: 'sat-marker-mini',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          if (!satMarkers[name]) {
            const marker = L.marker([lat, lon], { icon: satIcon })
              .bindTooltip(name, {
                permanent: false,
                direction: 'top',
                className: 'leaflet-tooltip-custom'
              })
              .addTo(map);

            marker.on('click', () => {
              if (activeFootprint) {
                map.removeLayer(activeFootprint);
              }
              const radius = getFootprintRadiusMeters(alt);
              activeFootprint = L.circle([lat, lon], {
                radius: radius,
                color: item.visible ? 'rgba(16, 185, 129, 0.4)' : 'rgba(75, 85, 99, 0.4)',
                fillColor: item.visible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(75, 85, 99, 0.08)',
                weight: 1.5
              }).addTo(map);
            });

            satMarkers[name] = marker;
          } else {
            const marker = satMarkers[name];
            marker.setLatLng([lat, lon]);
            marker.setIcon(satIcon);
            
            // Update the footprint circle's position and radius if this satellite has the active footprint
            if (activeFootprint && activeFootprint.getLatLng().lat === marker.getLatLng().lat && activeFootprint.getLatLng().lng === marker.getLatLng().lng) {
              activeFootprint.setLatLng([lat, lon]);
              activeFootprint.setRadius(getFootprintRadiusMeters(alt));
            }
          }
        } catch (e) {
          // ignore propagation errors
        }
      });
    }

    update();
    setInterval(update, 5000);
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#121212',
    marginHorizontal: 16,
    marginVertical: 10,
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
});
