import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface SignalIconProps {
  visible: boolean;
  elevation: number;
  azimuth: number | null;
}

export const SignalIcon: React.FC<SignalIconProps> = ({ visible, elevation, azimuth }) => {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (visible) {
      // Loop a pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0.4); // Greyed out static opacity
    }
  }, [visible]);

  // Determine signal bars
  let filledBars = 0;
  if (visible) {
    if (elevation > 45) {
      filledBars = 3;
    } else if (elevation >= 20) {
      filledBars = 2;
    } else if (elevation >= 10) {
      filledBars = 1;
    }
  }

  // Rotate according to azimuth, default to 0
  const rotationStr = azimuth !== null ? `${azimuth}deg` : '0deg';

  return (
    <View style={styles.container}>
      {/* Rotated, animated satellite icon */}
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            opacity: pulseAnim,
            transform: [{ rotate: rotationStr }],
          },
        ]}
      >
        <MaterialCommunityIcons
          name="satellite-variant"
          size={24}
          color={visible ? COLORS.accent_blue : COLORS.not_visible_gray}
        />
      </Animated.View>

      {/* 3 vertical signal bars */}
      <View style={styles.barsContainer}>
        {[1, 2, 3].map((bar) => {
          const isFilled = bar <= filledBars;
          return (
            <View
              key={bar}
              style={[
                styles.bar,
                { height: bar * 4 + 4 },
                isFilled
                  ? { backgroundColor: COLORS.accent_blue }
                  : { backgroundColor: COLORS.separator },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    justifyContent: 'space-between',
  },
  iconWrapper: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 18,
    width: 20,
    justifyContent: 'space-between',
    marginLeft: 4,
  },
  bar: {
    width: 4,
    borderRadius: 1,
  },
});
