import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  TouchableWithoutFeedback,
  Platform,
  BackHandler,
  TextInput,
} from 'react-native';
import { Ionicons, Entypo, MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { useSatellites } from '../hooks/useSatellites';
import { SectionHeader } from '../components/SectionHeader';
import { SatelliteCard } from '../components/SatelliteCard';

type RootStackParamList = {
  Home: undefined;
  Detail: { satellite: any; observerLat?: number | null; observerLon?: number | null };
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }: HomeScreenProps) => {
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);
  const [manualRefreshing, setManualRefreshing] = useState<boolean>(false);
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleBackPress = useCallback(() => {
    Alert.alert(
      "Exit App",
      "Are you sure you want to exit the app?",
      [
        { text: "No", onPress: () => null, style: "cancel" },
        { text: "Yes", onPress: () => BackHandler.exitApp() }
      ],
      { cancelable: true }
    );
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBackPress
      );
      return () => subscription.remove();
    }, [handleBackPress])
  );
  
  const showHelpAlert = () => {
    Alert.alert(
      "SatTrack Help",
      "1. Enable the 'Satellite Tracking' switch to start scanning.\n\n2. Satellites currently above a 10° elevation angle are shown under 'Visible Satellites'.\n\n3. Tap any satellite's 'i' icon to view detailed real-time coordinates and orbital tracking info.",
      [{ text: "OK", style: "default" }]
    );
  };


  const {
    visibleSats,
    notVisibleSats,
    location,
    lastUpdated,
    loading,
    error,
    refresh,
  } = useSatellites(trackingEnabled, searchQuery);

  const handleManualRefresh = async () => {
    setManualRefreshing(true);
    await refresh();
    // Keep spinner spinning for at least 1 second for visual satisfaction
    setTimeout(() => {
      setManualRefreshing(false);
    }, 1000);
  };

  const handlePullToRefresh = async () => {
    await refresh();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* Android Style Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SatTrack</Text>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
          <Entypo name="dots-three-vertical" size={20} color={COLORS.text_primary} />
        </TouchableOpacity>
      </View>

      {menuVisible && (
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleManualRefresh(); }}>
                  <Ionicons name="refresh" size={18} color={COLORS.text_primary} style={{ marginRight: 10 }} />
                  <Text style={styles.menuItemText}>Refresh Data</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); showHelpAlert(); }}>
                  <Ionicons name="help-circle-outline" size={18} color={COLORS.text_primary} style={{ marginRight: 10 }} />
                  <Text style={styles.menuItemText}>Help & Info</Text>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Switch Row */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Satellite Tracking</Text>
        <Switch
          value={trackingEnabled}
          onValueChange={(val) => setTrackingEnabled(val)}
          trackColor={{ false: COLORS.separator, true: COLORS.toggle_active }}
          thumbColor={COLORS.text_primary}
        />
      </View>

      {/* Search Bar Input */}
      {trackingEnabled && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={COLORS.text_secondary} style={styles.searchIcon} />
          <TextInput
            placeholder="Search satellites by name..."
            placeholderTextColor={COLORS.text_secondary}
            value={searchQuery}
            onChangeText={(text) => setSearchQuery(text)}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={COLORS.text_secondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Separator line */}
      <View style={styles.divider} />

      {/* Main List */}
      {trackingEnabled ? (
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={loading && !manualRefreshing}
              onRefresh={handlePullToRefresh}
              tintColor={COLORS.accent_blue}
              colors={[COLORS.accent_blue]}
            />
          }
        >


          {/* Last Updated Timestamp */}
          {lastUpdated && (
            <Text style={styles.timestamp}>
              Last updated: {lastUpdated}
            </Text>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Section: Visible Satellites */}
          <SectionHeader
            title="Visible satellites"
            showRefresh={true}
            onRefresh={handleManualRefresh}
            isRefreshing={manualRefreshing}
          />
          {visibleSats.length > 0 ? (
            <View style={styles.listCard}>
              {visibleSats.map((sat) => (
                <SatelliteCard
                  key={sat.name}
                  satellite={sat}
                  onPressInfo={() => navigation.navigate('Detail', { satellite: sat, observerLat: location?.lat, observerLon: location?.lon })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Scanning for satellites...</Text>
            </View>
          )}

          {/* Section: Not Currently Visible */}
          <SectionHeader title="Not currently visible" />
          {notVisibleSats.length > 0 ? (
            <View style={styles.listCard}>
              {notVisibleSats.map((sat) => (
                <SatelliteCard
                  key={sat.name}
                  satellite={sat}
                  onPressInfo={() => navigation.navigate('Detail', { satellite: sat, observerLat: location?.lat, observerLon: location?.lon })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No other satellites found.</Text>
            </View>
          )}
          
          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : (
        /* Disabled State Screen */
        <View style={styles.disabledContainer}>
          <MaterialCommunityIcons name="satellite-variant" size={64} color={COLORS.not_visible_gray} />
          <Text style={styles.disabledTitle}>Satellite tracking is off</Text>
          <Text style={styles.disabledText}>
            Turn on the switch above to search for active satellite footprints and calculate visibility.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  menuButton: {
    padding: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.text_primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.separator,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  timestamp: {
    color: COLORS.text_secondary,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  listCard: {
    backgroundColor: COLORS.card_background,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.card_background,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  emptyText: {
    color: COLORS.text_secondary,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#3E1F1F',
    margin: 16,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7F2F2F',
  },
  errorText: {
    color: '#FF8A8A',
    fontSize: 13,
    textAlign: 'center',
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: COLORS.background,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginTop: 16,
    marginBottom: 8,
  },
  disabledText: {
    fontSize: 14,
    color: COLORS.text_secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: COLORS.card_background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.separator,
    paddingVertical: 4,
    width: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: COLORS.text_primary,
    fontSize: 14,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card_background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.separator,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text_primary,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
});
