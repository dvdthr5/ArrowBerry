import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getDateString(daysFromToday = 0) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysFromToday);

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatExpiringItemsMessage(items) {
  const todayDate = getDateString();
  const tomorrowDate = getDateString(1);
  const todayItems = items.filter((item) => item.expiration_date === todayDate);
  const tomorrowItems = items.filter((item) => item.expiration_date === tomorrowDate);
  const messageParts = [];

  if (todayItems.length > 0) {
    const itemNames = todayItems
      .map((item) => item.item_name)
      .filter(Boolean)
      .join(', ');

    messageParts.push(`expire today: ${itemNames}`);
  }

  if (tomorrowItems.length > 0) {
    const itemNames = tomorrowItems
      .map((item) => item.item_name)
      .filter(Boolean)
      .join(', ');

    messageParts.push(`expire tomorrow: ${itemNames}`);
  }

  return `You have these items which ${messageParts.join('; ')}. Use them today!`;
}

function formatExpiredItemsMessage(items) {
  const itemNames = items
    .map((item) => item.item_name)
    .filter(Boolean)
    .join(', ');

  return `These pantry items have already expired: ${itemNames}. You should get rid of them.`;
}

async function requestNotificationPermissions() {
  console.log('Checking notification permissions...');

  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiration-reminders', {
      name: 'Expiration reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  console.log('Existing notification permissions:', existingPermissions);

  if (existingPermissions.status === 'granted') {
    return true;
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync();
  console.log('Requested notification permissions:', requestedPermissions);

  return requestedPermissions.status === 'granted';
}

export async function notifyItemsExpiringSoon() {
  console.log('Checking for pantry items expiring today or tomorrow...');

  const hasPermission = await requestNotificationPermissions();

  if (!hasPermission) {
    console.log('Notification permission was not granted.');
    return {
      success: false,
      reason: 'Notification permission was not granted.',
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    console.log('No authenticated user found for expiration notification.');
    return {
      success: false,
      reason: 'No authenticated user found.',
    };
  }

  const todayDate = getDateString();
  const tomorrowDate = getDateString(1);

  const { data: expiringItems, error } = await supabase
    .from('pantry_items')
    .select('item_name, expiration_date')
    .eq('user_id', authData.user.id)
    .in('expiration_date', [todayDate, tomorrowDate]);

  if (error) {
    console.log('Failed to fetch expiring pantry items:', error.message);
    return {
      success: false,
      reason: error.message,
    };
  }

  console.log('Pantry items expiring today or tomorrow:', expiringItems || []);

  if (!expiringItems?.length) {
    return {
      success: true,
      notificationScheduled: false,
      reason: 'No pantry items expire today or tomorrow.',
    };
  }

  const notificationBody = formatExpiringItemsMessage(expiringItems);
  console.log('Scheduling expiration notification:', notificationBody);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pantry Expiration Reminder',
      body: notificationBody,
      data: {
        type: 'expiring_items_soon',
        expirationDates: [todayDate, tomorrowDate],
      },
    },
    trigger: null,
  });

  console.log('Expiration notification scheduled:', notificationId);

  return {
    success: true,
    notificationScheduled: true,
    notificationId,
    items: expiringItems,
  };
}

export async function notifyExpiredItems() {
  console.log('Checking for pantry items that have already expired...');

  const hasPermission = await requestNotificationPermissions();

  if (!hasPermission) {
    console.log('Notification permission was not granted.');
    return {
      success: false,
      reason: 'Notification permission was not granted.',
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    console.log('No authenticated user found for expired item notification.');
    return {
      success: false,
      reason: 'No authenticated user found.',
    };
  }

  const todayDate = getDateString();

  const { data: expiredItems, error } = await supabase
    .from('pantry_items')
    .select('item_name, expiration_date')
    .eq('user_id', authData.user.id)
    .lt('expiration_date', todayDate);

  if (error) {
    console.log('Failed to fetch expired pantry items:', error.message);
    return {
      success: false,
      reason: error.message,
    };
  }

  console.log('Expired pantry items:', expiredItems || []);

  if (!expiredItems?.length) {
    return {
      success: true,
      notificationScheduled: false,
      reason: 'No pantry items have already expired.',
    };
  }

  const notificationBody = formatExpiredItemsMessage(expiredItems);
  console.log('Scheduling expired item notification:', notificationBody);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Expired Pantry Items',
      body: notificationBody,
      data: {
        type: 'expired_items',
        beforeDate: todayDate,
      },
    },
    trigger: null,
  });

  console.log('Expired item notification scheduled:', notificationId);

  return {
    success: true,
    notificationScheduled: true,
    notificationId,
    items: expiredItems,
  };
}

export function scheduleExpirationNotificationAfterAppLoad() {
  const expiringSoonTimeoutId = setTimeout(() => {
    notifyItemsExpiringSoon();
  }, 15000);

  const expiredItemsTimeoutId = setTimeout(() => {
    notifyExpiredItems();
  }, 30000);

  return () => {
    clearTimeout(expiringSoonTimeoutId);
    clearTimeout(expiredItemsTimeoutId);
  };
}