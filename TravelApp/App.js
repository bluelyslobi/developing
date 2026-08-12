import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

import { AuthProvider } from './context/AuthContext';
import HomeScreen from './screens/HomeScreen';
import CommunityScreen from './screens/CommunityScreen';
import MarketScreen from './screens/MarketScreen';
import PackageScreen from './screens/PackageScreen';
import ProfileScreen from './screens/ProfileScreen';

// Expo Go SDK 53+에서 push notifications 제거됨 → dynamic require로 Expo Go에서 로드 방지
const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    if (isExpoGo) return;
    (async () => {
      try {
        const Notifications = require('expo-notifications');
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) return;
        await Notifications.getExpoPushTokenAsync({ projectId });
      } catch {}
    })();
  }, []);

  return (
    <AuthProvider>
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#4ECDC4',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Home: focused ? 'home' : 'home-outline',
              Community: focused ? 'chatbubbles' : 'chatbubbles-outline',
              Market: focused ? 'storefront' : 'storefront-outline',
              Package: focused ? 'airplane' : 'airplane-outline',
              Profile: focused ? 'person' : 'person-outline',
            };
            return <Ionicons name={icons[route.name]} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '홈' }} />
        <Tab.Screen name="Community" component={CommunityScreen} options={{ tabBarLabel: '커뮤니티' }} />
        <Tab.Screen name="Market" component={MarketScreen} options={{ tabBarLabel: '중고거래' }} />
        <Tab.Screen name="Package" component={PackageScreen} options={{ tabBarLabel: '패키지' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '마이' }} />
      </Tab.Navigator>
    </NavigationContainer>
    </AuthProvider>
  );
}
