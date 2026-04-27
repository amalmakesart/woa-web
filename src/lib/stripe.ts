import Constants from 'expo-constants';

export const stripePublishableKey =
  (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) ?? '';
