import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { registerForPushNotifications } from '../../lib/pushNotifications';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const DISPLAY = Platform.select({ ios: 'Georgia', android: 'serif' }) as string;
const PERMISSIONS_KEY = '@woa_permissions_shown';

interface PermRow {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  tone: string;
}

const PERMISSIONS: PermRow[] = [
  {
    icon: 'mic-outline',
    title: 'MICROPHONE',
    desc: 'FOR AUDIO POSTS, VOICE-BASED CREATION, AND ANY MOMENT YOU WANT TO SHARE SOUND AS PART OF YOUR PRACTICE.',
    tone: '#f6c55a',
  },
  {
    icon: 'images-outline',
    title: 'PHOTOS',
    desc: 'TO UPLOAD PROFILE IMAGES, GIG VISUALS, AND FEED POSTS THAT ACTUALLY SHOW YOUR WORK.',
    tone: '#d1a57d',
  },
  {
    icon: 'location-outline',
    title: 'LOCATION',
    desc: 'TO HELP SURFACE GIGS NEAR YOU AND MAKE DISCOVERY FEEL LOCAL WHEN IT SHOULD.',
    tone: '#c0392b',
  },
  {
    icon: 'notifications-outline',
    title: 'NOTIFICATIONS',
    desc: 'FOR MESSAGES, GIG INTEREST, FOLLOW ACTIVITY, AND THE THINGS YOU WOULD HATE TO MISS.',
    tone: '#f6c55a',
  },
];

async function requestAllPermissions() {
  try {
    try {
      const { Audio } = await import('expo-av');
      await Audio.requestPermissionsAsync();
    } catch {}

    try {
      const ImagePicker = await import('expo-image-picker');
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch {}

    try {
      const Location = await import('expo-location');
      await Location.requestForegroundPermissionsAsync();
    } catch {}

    try {
      await registerForPushNotifications();
    } catch {}
  } catch {}
}

export default function PermissionsScreen() {
  const navigation = useNavigation<any>();

  const finish = async () => {
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleContinue = async () => {
    await requestAllPermissions();
    await finish();
  };

  const handleSkip = async () => {
    await finish();
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <Text style={s.topBarBrand}>WORK(ER) OF ART</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.bgGlowTop} />
        <View style={s.bgGlowBottom} />
        <View style={s.heroCard}>
          <Text style={s.eyebrow}>SETUP</Text>
          <Text style={s.title}>A few permissions, so the app can actually do its job.</Text>
          <Text style={s.subtitle}>
            NOTHING HERE IS RANDOM. EACH ONE UNLOCKS A CORE PART OF THE EXPERIENCE, AND YOU CAN CHANGE THEM LATER IN YOUR PHONE SETTINGS.
          </Text>
        </View>

        <View style={s.stack}>
          {PERMISSIONS.map((perm) => (
            <View key={perm.title} style={s.permissionCard}>
              <View style={[s.iconWrap, { borderColor: perm.tone, backgroundColor: `${perm.tone}12` }]}>
                <Ionicons name={perm.icon} size={18} color={perm.tone} />
              </View>
              <View style={s.permissionInfo}>
                <Text style={s.permissionTitle}>{perm.title}</Text>
                <Text style={s.permissionDesc}>{perm.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.noteBox}>
          <Text style={s.noteTitle}>YOU'RE STILL IN CONTROL</Text>
          <Text style={s.noteText}>
            SAY YES NOW FOR THE SMOOTHEST START, OR SKIP AND TURN THINGS ON ONLY WHEN YOU NEED THEM.
          </Text>
        </View>

        <View style={s.actions}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>ALLOW & CONTINUE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} onPress={handleSkip} activeOpacity={0.85}>
            <Text style={s.secondaryBtnText}>CONTINUE FOR NOW</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footerNote}>YOU CAN REVIEW EVERY PERMISSION AGAIN LATER FROM SETTINGS.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020202' },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topBarBrand: {
    color: '#7a7a7a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.18,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  bgGlowTop: {
    position: 'absolute',
    top: 40,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(246,197,90,0.08)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: 120,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(192,57,43,0.08)',
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#2a2518',
    backgroundColor: 'rgba(8,8,8,0.94)',
    padding: 20,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#f6c55a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  title: {
    color: colors.white,
    fontFamily: DISPLAY,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 14,
  },
  subtitle: {
    color: '#cfcfcf',
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.08,
    lineHeight: 20,
  },
  stack: { gap: 12, marginBottom: 18 },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: 'rgba(10,10,10,0.94)',
    padding: 16,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionInfo: { flex: 1 },
  permissionTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.18,
    marginBottom: 6,
  },
  permissionDesc: {
    color: '#9e9e9e',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  noteBox: {
    borderWidth: 1,
    borderColor: '#221a19',
    backgroundColor: '#090707',
    padding: 16,
    marginBottom: 22,
  },
  noteTitle: {
    color: '#f6c55a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.18,
    marginBottom: 8,
  },
  noteText: {
    color: '#b0a7a7',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.08,
    lineHeight: 17,
  },
  actions: { gap: 10, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: '#f6c55a',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.black,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.24,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#3a3a3a',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  secondaryBtnText: {
    color: '#bcbcbc',
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  footerNote: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.14,
    textAlign: 'center',
    lineHeight: 16,
  },
});
