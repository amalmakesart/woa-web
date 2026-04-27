import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;

async function getNotificationsModule() {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          // Keep foreground notifications inside the custom WOA banner flow.
          // System notifications will still appear when the app is backgrounded/closed.
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });
      return Notifications;
    });
  }

  return notificationsModulePromise;
}

function getProjectId() {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    null
  );
}

export async function registerForPushNotifications(userId?: string | null) {
  try {
    const Notifications = await getNotificationsModule();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId = getProjectId();
    if (!projectId) return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return null;

    const targetUserId = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (targetUserId) {
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', targetUserId);
    }

    return token;
  } catch (error) {
    console.warn('Failed to register push notifications', error);
    return null;
  }
}
