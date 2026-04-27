module.exports = {
  expo: {
    name: 'WORK(ER) OF ART',
    slug: 'workerofart',
    scheme: 'workerofart',
    version: '1.0.6',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: false,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.workerofart.app',
      buildNumber: '1',
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
        ],
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'WOA needs camera access to upload photos to your profile and Art Feed.',
        NSPhotoLibraryUsageDescription:
          'WOA needs photo library access to upload images to your profile and Art Feed.',
        NSMicrophoneUsageDescription:
          'WOA needs microphone access to record and upload audio posts to your Art Feed.',
        NSLocationWhenInUseUsageDescription:
          'WOA uses your location to notify you of gigs posted near your city.',
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      package: 'com.workerofart.app',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#c0392b',
          sounds: [],
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'WOA needs photo library access to upload images to your profile and Art Feed.',
          cameraPermission:
            'WOA needs camera access to upload photos to your profile and Art Feed.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'WOA uses your location to notify you of gigs posted near your city.',
        },
      ],
      [
        'expo-av',
        {
          microphonePermission:
            'WOA needs microphone access to record and upload audio posts to your Art Feed.',
        },
      ],
    ],
    extra: {
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_URL ??
        'https://tehkoxslqtgofivlcdyk.supabase.co',
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        'sb_publishable_lwgQsrT4prd3upPoGGu7QA_csHmVUnt',
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
      eas: {
        projectId: '6cab841b-f450-45b2-808c-71524392fc5e',
      },
    },
  },
};
