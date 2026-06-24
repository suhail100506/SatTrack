import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { HomeScreen } from './app/screens/HomeScreen';
import { DetailScreen } from './app/screens/DetailScreen';
import { SatelliteResult } from './app/types/satellite';

type RootStackParamList = {
  Home: undefined;
  Detail: { satellite: SatelliteResult; observerLat?: number | null; observerLon?: number | null };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        >
          {/* Main Wifi settings list view */}
          <Stack.Screen name="Home" component={HomeScreen} />
          
          {/* Detail sheet rendered as a transparent modal sliding up */}
          <Stack.Screen
            name="Detail"
            component={DetailScreen}
            options={{
              presentation: 'transparentModal',
              cardStyle: { backgroundColor: 'transparent' },
              cardStyleInterpolator: ({ current: { progress } }) => ({
                cardStyle: {
                  opacity: progress.interpolate({
                    inputRange: [0, 0.5, 0.9, 1],
                    outputRange: [0, 0.25, 0.7, 1],
                  }),
                },
              }),
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
