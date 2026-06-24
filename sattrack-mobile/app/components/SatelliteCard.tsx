import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { SatelliteResult } from '../types/satellite';
import { SignalIcon } from './SignalIcon';

interface SatelliteCardProps {
  satellite: SatelliteResult;
  onPressInfo: () => void;
}

export const SatelliteCard: React.FC<SatelliteCardProps> = ({ satellite, onPressInfo }) => {
  // Parse orbit type badge
  const getOrbitBadge = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('GEO')) {
      return { label: 'GEO', color: COLORS.badge_geo };
    }
    if (upper.includes('LEO')) {
      return { label: 'LEO', color: COLORS.badge_leo };
    }
    if (upper.includes('MEO')) {
      return { label: 'MEO', color: COLORS.badge_meo };
    }
    if (upper.includes('HEO') || upper.includes('MOLNIYA')) {
      return { label: 'HEO', color: COLORS.badge_heo };
    }
    return null;
  };

  const badge = getOrbitBadge(satellite.name);

  // Format elevation & azimuth text
  const elevText = `${satellite.elevation_deg.toFixed(2)}°`;
  const azText = satellite.azimuth_deg !== null ? `${satellite.azimuth_deg.toFixed(2)}°` : null;

  const formatDuration = (totalMinutes: number | null) => {
    if (totalMinutes === null || totalMinutes === undefined) return '';
    const totalMinutesRound = Math.round(totalMinutes);
    const hrs = Math.floor(totalMinutesRound / 60);
    const mins = totalMinutesRound % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Format visibility details
  const getStatusString = () => {
    if (satellite.visible) {
      if (satellite.no_pass_in_horizon) {
        return 'Visible > 24 hours';
      }
      const timeStr = satellite.visible_until_utc 
        ? satellite.visible_until_utc.substring(11, 19) 
        : '';
      return `Visible until ${timeStr} UTC (${formatDuration(satellite.visible_for_minutes)})`;
    } else {
      if (satellite.no_pass_in_horizon) {
        return 'No pass within next 24h';
      }
      const timeStr = satellite.next_visible_at_utc
        ? satellite.next_visible_at_utc.substring(11, 19)
        : '';
      return `Next pass: ${timeStr} UTC (${formatDuration(satellite.next_visible_duration_minutes)})`;
    }
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.leftSection}>
        {/* Animated signal icon */}
        <SignalIcon
          visible={satellite.visible}
          elevation={satellite.elevation_deg}
          azimuth={satellite.azimuth_deg}
        />

        {/* Text information */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.nameText} numberOfLines={1}>{satellite.name}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: badge.color }]}>
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            )}
          </View>

          <Text style={styles.elevationText}>
            Elevation: {elevText} {azText ? ` | Azimuth: ${azText}` : ''}
          </Text>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: satellite.visible ? COLORS.visible_green : COLORS.not_visible_gray },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: satellite.visible ? COLORS.text_primary : COLORS.text_secondary },
              ]}
            >
              {getStatusString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Info button */}
      <TouchableOpacity
        style={styles.infoButton}
        onPress={onPressInfo}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`View ${satellite.name} details`}
      >
        <Feather name="info" size={20} color={COLORS.accent_blue} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card_background,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  nameText: {
    color: COLORS.text_primary,
    fontSize: 16,
    fontWeight: '500',
    marginRight: 6,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  elevationText: {
    color: COLORS.text_secondary,
    fontSize: 13,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
  },
  infoButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
