import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../constants/theme';
import { SatelliteResult } from '../types/satellite';
import { GroundTrackMap } from '../components/GroundTrackMap';

type RootStackParamList = {
  Home: undefined;
  Detail: { satellite: SatelliteResult; observerLat?: number | null; observerLon?: number | null };
};

type DetailScreenRouteProp = RouteProp<RootStackParamList, 'Detail'>;
type DetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Detail'>;

interface DetailScreenProps {
  route: DetailScreenRouteProp;
  navigation: DetailScreenNavigationProp;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const DetailScreen: React.FC<DetailScreenProps> = ({ route, navigation }: DetailScreenProps) => {
  const { satellite, observerLat, observerLon } = route.params;

  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // Backdrop opacity
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Countdown timer for remaining minutes
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (satellite.visible && satellite.visible_for_minutes && !satellite.no_pass_in_horizon) {
      return Math.round(satellite.visible_for_minutes * 60);
    }
    return null;
  });

  // Track dynamic coordinates/altitude from slider or real-time propagation in map
  const [currentSubLat, setCurrentSubLat] = useState<number | null>(satellite.sub_point_lat);
  const [currentSubLon, setCurrentSubLon] = useState<number | null>(satellite.sub_point_lon);
  const [currentAlt, setCurrentAlt] = useState<number | null>(satellite.sat_altitude_km);

  useEffect(() => {
    // Slide up modal
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0.5,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  };

  // Format countdown string
  const formatCountdown = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins}m ${secs}s`;
  };

  // Convert coordinate to N/S E/W format
  const formatLat = (lat: number | null) => {
    if (lat === null) return 'N/A';
    return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  };

  const formatLon = (lon: number | null) => {
    if (lon === null) return 'N/A';
    return `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
  };

  // Map sub-point lat/lon coordinates from dynamic state
  const subLat = currentSubLat !== null ? currentSubLat : (satellite.sub_point_lat || 0);
  const subLon = currentSubLon !== null ? currentSubLon : (satellite.sub_point_lon || 0);

  const formatDuration = (totalMinutes: number | null) => {
    if (totalMinutes === null || totalMinutes === undefined) return 'N/A';
    const totalMinutesRound = Math.round(totalMinutes);
    const hrs = Math.floor(totalMinutesRound / 60);
    const mins = totalMinutesRound % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <View style={styles.outerContainer}>
      {/* Semi-transparent backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Sliding Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHeader}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Main Title & Status */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>{satellite.name}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: satellite.visible ? COLORS.visible_green : COLORS.not_visible_gray },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: satellite.visible ? COLORS.visible_green : COLORS.text_secondary },
                ]}
              >
                {satellite.visible ? 'Currently Visible' : 'Not Visible'}
              </Text>
            </View>
          </View>

          {/* Section: Position */}
          <Text style={styles.sectionLabel}>POSITION</Text>
          <View style={styles.detailsGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Elevation</Text>
              <Text style={styles.detailValue}>{satellite.elevation_deg.toFixed(2)}°</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Azimuth</Text>
              <Text style={styles.detailValue}>
                {satellite.azimuth_deg !== null ? `${satellite.azimuth_deg.toFixed(2)}°` : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Range</Text>
              <Text style={styles.detailValue}>
                {satellite.range_km !== null ? `${satellite.range_km.toLocaleString()} km` : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Altitude</Text>
              <Text style={styles.detailValue}>
                {currentAlt !== null ? `${Math.round(currentAlt).toLocaleString()} km` : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Section: Satellite Ground Track */}
          <Text style={styles.sectionLabel}>SATELLITE GROUND TRACK</Text>
          <View style={styles.detailsGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailName}>Sub-point</Text>
              <Text style={styles.detailValue}>
                ({formatLat(subLat)}, {formatLon(subLon)})
              </Text>
            </View>
            
            {satellite.tle_line1 && satellite.tle_line2 ? (
              <GroundTrackMap
                tleLine1={satellite.tle_line1}
                tleLine2={satellite.tle_line2}
                satName={satellite.name}
                observerLat={observerLat}
                observerLon={observerLon}
                onCoordinatesUpdate={(lat, lon, alt) => {
                  setCurrentSubLat(lat);
                  setCurrentSubLon(lon);
                  setCurrentAlt(alt);
                }}
              />
            ) : (
              <View style={styles.noTleBox}>
                <Text style={styles.noTleText}>TLE data unavailable for tracking</Text>
              </View>
            )}
          </View>

          {/* Section: Timing */}
          <Text style={styles.sectionLabel}>TIMING</Text>
          <View style={styles.detailsGroup}>
            {satellite.visible ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailName}>Visible until</Text>
                  <Text style={styles.detailValue}>
                    {satellite.no_pass_in_horizon 
                      ? 'N/A' 
                      : (satellite.visible_until_utc?.substring(11, 19) || 'N/A') + ' UTC'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailName}>Remaining time</Text>
                  <Text style={[styles.detailValue, { color: COLORS.visible_green, fontWeight: 'bold' }]}>
                    {satellite.no_pass_in_horizon
                      ? '> 24 hrs (GEO)'
                      : secondsLeft !== null
                      ? formatCountdown(secondsLeft)
                      : 'N/A'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailName}>Next pass</Text>
                  <Text style={styles.detailValue}>
                    {satellite.no_pass_in_horizon 
                      ? 'No pass in search horizon' 
                      : (satellite.next_visible_at_utc?.substring(11, 19) || 'N/A') + ' UTC'}
                  </Text>
                </View>
                {!satellite.no_pass_in_horizon && (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailName}>Duration</Text>
                      <Text style={styles.detailValue}>
                        {formatDuration(satellite.next_visible_duration_minutes)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailName}>Move toward</Text>
                      <Text style={styles.detailValue}>
                        ({formatLat(satellite.nearest_point_lat)}, {formatLon(satellite.nearest_point_lon)})
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailName}>Distance needed</Text>
                      <Text style={[styles.detailValue, { color: COLORS.accent_blue }]}>
                        {satellite.distance_to_nearest_point_km?.toLocaleString()} km
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>CLOSE</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    backgroundColor: COLORS.card_background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: 24,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.separator,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  titleSection: {
    marginBottom: 20,
  },
  titleText: {
    color: COLORS.text_primary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.accent_blue,
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  detailsGroup: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  detailName: {
    color: COLORS.text_secondary,
    fontSize: 14,
  },
  detailValue: {
    color: COLORS.text_primary,
    fontSize: 14,
    fontWeight: '500',
  },
  noTleBox: {
    height: 150,
    backgroundColor: '#151515',
    marginVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.separator,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTleText: {
    color: COLORS.text_secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: COLORS.separator,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: COLORS.text_primary,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
