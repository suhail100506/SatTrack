import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';

interface SectionHeaderProps {
  title: string;
  showRefresh?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  showRefresh = false,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>{title.toUpperCase()}</Text>
      {showRefresh && onRefresh && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={isRefreshing}
          activeOpacity={0.6}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={COLORS.accent_blue} />
          ) : (
            <Text style={styles.refreshText}>Refresh</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
  },
  titleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.accent_blue,
    letterSpacing: 0.8,
  },
  refreshButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  refreshText: {
    fontSize: 14,
    color: COLORS.accent_blue,
    fontWeight: '600',
  },
});
