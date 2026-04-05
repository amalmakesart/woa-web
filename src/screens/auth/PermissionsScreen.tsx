import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const PERMISSIONS_KEY = '@woa_permissions_shown';

interface PermRow {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}

const PERMISSIONS: PermRow[] = [
  {
    icon: 'mic-outline',
    title: 'MICROPHONE',
    desc: 'TO RECORD AND UPLOAD AUDIO POSTS TO YOUR ART FEED.',
  },
  {
    icon: 'camera-outline',
    title: 'CAMERA & PHOTOS',
    desc: 'TO UPLOAD IMAGES TO YOUR PROFILE AND ART FEED.',
  },
  {
    icon: 'location-outline',
    title: 'LOCATION',
    desc: 'TO NOTIFY YOU OF GIGS POSTED NEAR YOUR CITY.',
  },
  {
    icon: 'notifications-outline',
    title: 'NOTIFICATIONS',
    desc: 'FOR NEW GIGS, FOLLOWERS, MESSAGES AND POST ACTIVITY.',
  },
];

async function requestAllPermissions() {
  try {
    // Microphone
    try {
      const { Audio } = await import('expo-av');
      await Audio.requestPermissionsAsync();
    } catch {}

    // Camera & Photos
    try {
      const ImagePicker = await import('expo-image-picker');
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch {}

    // Location
    try {
      const Location = await import('expo-location');
      await Location.requestForegroundPermissionsAsync();
    } catch {}

    // Notifications
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.requestPermissionsAsync();
    } catch {}
  } catch {}
}

export default function PermissionsScreen() {
  const navigation = useNavigation<any>();

  const handleContinue = async () => {
    await requestAllPermissions();
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>BEFORE WE BEGIN</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Text style={s.title}>A FEW PERMISSIONS</Text>
        <Text style={s.subtitle}>
          WOA NEEDS THE FOLLOWING TO WORK PROPERLY. YOU CAN CHANGE THESE ANYTIME IN YOUR PHONE SETTINGS.
        </Text>

        {PERMISSIONS.map(perm => (
          <View key={perm.title} style={s.permRow}>
            <View style={s.iconBox}>
              <Ionicons name={perm.icon} size={16} color="#444444" />
            </View>
            <View style={s.permInfo}>
              <Text style={s.permTitle}>{perm.title}</Text>
              <Text style={s.permDesc}>{perm.desc}</Text>
            </View>
          </View>
        ))}

        <View style={s.actions}>
          <TouchableOpacity style={s.continueBtn} onPress={handleContinue} activeOpacity={0.7}>
            <Text style={s.continueBtnText}>CONTINUE</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={s.skipText}>YOU CAN ENABLE THESE LATER IN SETTINGS</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  content: { paddingHorizontal: 16, paddingTop: 24 },

  topBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  topBarTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },

  title: {
    color: colors.white, fontFamily: MONO,
    fontSize: 12, letterSpacing: 0.3,
    textAlign: 'center', marginBottom: 12,
  },
  subtitle: {
    color: '#444444', fontFamily: MONO,
    fontSize: 8, letterSpacing: 0.1, lineHeight: 14,
    textAlign: 'center', marginBottom: 32,
  },

  permRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    minHeight: 44, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
  },
  iconBox: {
    width: 28, height: 28,
    borderWidth: 1, borderColor: '#222222',
    alignItems: 'center', justifyContent: 'center',
  },
  permInfo: { flex: 1 },
  permTitle: { color: colors.white, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15, marginBottom: 4 },
  permDesc: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.1, lineHeight: 10 },

  actions: { paddingTop: 32, alignItems: 'center', gap: 16 },
  continueBtn: {
    width: '100%', borderWidth: 1, borderColor: colors.red,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  continueBtnText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.3 },
  skipText: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.12 },
});
