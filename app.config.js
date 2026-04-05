module.exports = {
  expo: {
    name: 'WORK(ER) OF ART',
    slug: 'workerofart',
    version: '1.0.0',
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
      infoPlist: {
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
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    },
  },
};
