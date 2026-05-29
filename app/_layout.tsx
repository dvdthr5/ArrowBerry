import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleExpirationNotificationAfterAppLoad } from '../lib/notifications';

export default function RootLayout() {
  useEffect(() => {
    const cleanupExpirationNotification = scheduleExpirationNotificationAfterAppLoad();

    return cleanupExpirationNotification;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}