import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import axios from 'axios';
import { SatelliteResult } from '../types/satellite';

// REPLACE THIS WITH YOUR PC'S LOCAL IP ADDRESS (e.g. 192.168.1.X or similar)
// If you are running on an emulator on the same PC:
// - Android Emulator: use 'http://10.0.2.2:5000'
// - iOS Simulator / Physical Device: use your machine's local Wi-Fi IP (e.g. 'http://192.168.X.X:5000')
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.48.161:5002';

export const useSatellites = (trackingEnabled: boolean = true, searchQuery: string = "") => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleSats, setVisibleSats] = useState<SatelliteResult[]>([]);
  const [notVisibleSats, setNotVisibleSats] = useState<SatelliteResult[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (latVal: number, lonVal: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/satellites`, {
        params: { lat: latVal, lon: lonVal, search: searchQuery },
        timeout: 10000,
      });
      const data = response.data;
      const sats: SatelliteResult[] = data.satellites || [];
      setVisibleSats(sats.filter((s: SatelliteResult) => s.visible));
      setNotVisibleSats(sats.filter((s: SatelliteResult) => !s.visible));

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastUpdated(timeStr);
      setError(null);
    } catch (err: any) {
      console.error("API Fetch Error:", err.message);
      setError("Network error. Ensure Flask API is running and IP is correct.");
    }
  }, [searchQuery]);

  const refresh = useCallback(async () => {
    if (!trackingEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLat = loc.coords.latitude;
      const newLon = loc.coords.longitude;
      setLat(newLat);
      setLon(newLon);
      await fetchData(newLat, newLon);
    } catch (err: any) {
      console.error("Location or fetch error:", err);
      setError("Failed to determine location or fetch data.");
    } finally {
      setLoading(false);
    }
  }, [fetchData, trackingEnabled]);

  // Handle manual tracking toggle and polling interval
  useEffect(() => {
    if (!trackingEnabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setVisibleSats([]);
      setNotVisibleSats([]);
      setLoading(false);
      return;
    }

    refresh();

    timerRef.current = setInterval(() => {
      refresh();
    }, 60000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [trackingEnabled, refresh]);

  return {
    visibleSats,
    notVisibleSats,
    location: lat !== null && lon !== null ? { lat, lon } : null,
    lastUpdated,
    loading,
    error,
    refresh,
  };
};
