import React, { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/colors';
import { navigationRef } from '../lib/navigationRef';
import NotificationBanner from '../components/NotificationBanner';

// Auth
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import PermissionsScreen from '../screens/auth/PermissionsScreen';

// Feed
import FeedScreen from '../screens/feed/FeedScreen';
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import NewPostScreen from '../screens/feed/NewPostScreen';

// Artists
import ArtistsScreen from '../screens/artists/ArtistsScreen';
import ArtistProfileScreen from '../screens/artists/ArtistProfileScreen';

// Gigs
import GigsScreen from '../screens/gigs/GigsScreen';
import GigDetailScreen from '../screens/gigs/GigDetailScreen';
import ExpressInterestScreen from '../screens/gigs/ExpressInterestScreen';
import PostGigScreen from '../screens/gigs/PostGigScreen';
import InterestedArtistsScreen from '../screens/gigs/InterestedArtistsScreen';

// Features
import FeaturesScreen from '../screens/features/FeaturesScreen';
import FilmDetailScreen from '../screens/features/FilmDetailScreen';
import AddFeatureScreen from '../screens/features/AddFeatureScreen';

// Messaging
import InboxScreen from '../screens/messaging/InboxScreen';
import ConversationScreen from '../screens/messaging/ConversationScreen';

// Notifications
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Context
import { UnreadProvider } from '../contexts/UnreadContext';

// Profile
import ProfileScreen from '../screens/profile/ProfileScreen';
import MyPostsScreen from '../screens/profile/MyPostsScreen';
import BookmarksScreen from '../screens/profile/BookmarksScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import DeleteAccountScreen from '../screens/profile/DeleteAccountScreen';
import DataUsageScreen from '../screens/profile/DataUsageScreen';

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#000000' },
} as const;

// ─── Feed Stack ───────────────────────────────────────────────────────────────

const FeedStack = createNativeStackNavigator();
function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <FeedStack.Screen name="FeedMain" component={FeedScreen} />
      <FeedStack.Screen name="PostDetail" component={PostDetailScreen} />
      <FeedStack.Screen name="NewPost" component={NewPostScreen} />
      <FeedStack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
    </FeedStack.Navigator>
  );
}

// ─── Artists Stack ────────────────────────────────────────────────────────────

const ArtistsStack = createNativeStackNavigator();
function ArtistsNavigator() {
  return (
    <ArtistsStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <ArtistsStack.Screen name="ArtistsMain" component={ArtistsScreen} />
      <ArtistsStack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
      <ArtistsStack.Screen name="PostDetail" component={PostDetailScreen} />
    </ArtistsStack.Navigator>
  );
}

// ─── Gigs Stack ───────────────────────────────────────────────────────────────

const GigsStack = createNativeStackNavigator();
function GigsNavigator() {
  return (
    <GigsStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <GigsStack.Screen name="GigsMain" component={GigsScreen} />
      <GigsStack.Screen name="GigDetail" component={GigDetailScreen} />
      <GigsStack.Screen name="ExpressInterest" component={ExpressInterestScreen} />
      <GigsStack.Screen name="PostGig" component={PostGigScreen} />
      <GigsStack.Screen name="InterestedArtists" component={InterestedArtistsScreen} />
      <GigsStack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
    </GigsStack.Navigator>
  );
}

// ─── Features Stack ───────────────────────────────────────────────────────────

const FeaturesStack = createNativeStackNavigator();
function FeaturesNavigator() {
  return (
    <FeaturesStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <FeaturesStack.Screen name="FeaturesMain" component={FeaturesScreen} />
      <FeaturesStack.Screen name="FilmDetail" component={FilmDetailScreen} />
      <FeaturesStack.Screen name="AddFeature" component={AddFeatureScreen} />
      <FeaturesStack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
    </FeaturesStack.Navigator>
  );
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Artists: '◉',
  Gigs: '◻',
  Features: '▷',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.black,
          borderTopWidth: 1,
          borderTopColor: colors.gray2,
        },
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.gray4,
        tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.18 },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'Feed') {
            return <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />;
          }
          return <Text style={{ color, fontSize: 16 }}>{TAB_ICONS[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedNavigator} />
      <Tab.Screen name="Artists" component={ArtistsNavigator} />
      <Tab.Screen name="Gigs" component={GigsNavigator} />
      <Tab.Screen name="Features" component={FeaturesNavigator} />
    </Tab.Navigator>
  );
}

// ─── Root Stack ───────────────────────────────────────────────────────────────

const Root = createNativeStackNavigator();

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const ONBOARDING_KEY = '@woa_onboarding_seen';

function SplashLoader() {
  return (
    <View style={launch.wrap}>
      <View style={launch.box}>
        <Text style={launch.line}>WORK(ER)</Text>
        <View style={launch.row}>
          <Text style={launch.line}>OF ART </Text>
          <Text style={launch.dot}>●</Text>
        </View>
      </View>
      <ActivityIndicator color={colors.red} size="small" style={{ marginTop: 40 }} />
    </View>
  );
}

function NoInternetScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={launch.wrap}>
      <Text style={launch.noConnTitle}>NO CONNECTION</Text>
      <Text style={launch.noConnSub}>PLEASE CHECK YOUR NETWORK</Text>
      <TouchableOpacity style={launch.retryBtn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={launch.retryText}>TRY AGAIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const launch = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 1, borderColor: '#ffffff', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  line: { color: '#ffffff', fontFamily: MONO, fontSize: 12, letterSpacing: 0.25 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { color: '#c0392b', fontSize: 12 },
  noConnTitle: { color: '#ffffff', fontFamily: MONO, fontSize: 11, letterSpacing: 0.3, marginBottom: 10 },
  noConnSub: { color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.15, marginBottom: 28 },
  retryBtn: { borderWidth: 1, borderColor: '#c0392b', paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#c0392b', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },
});

export default function AppNavigator() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>('Onboarding');
  const [noInternet, setNoInternet] = useState(false);

  const init = async () => {
    setNoInternet(false);
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setNoInternet(true);
      setReady(true);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setInitialRoute('Main');
        setReady(true);
        return;
      }
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (seen === 'true') {
        setInitialRoute('SignUp');
      } else {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        setInitialRoute('Onboarding');
      }
    } catch {
      setInitialRoute('Onboarding');
    } finally {
      setReady(true);
    }
  };

  useEffect(() => { init(); }, []);

  if (!ready) return <SplashLoader />;
  if (noInternet) return <NoInternetScreen onRetry={() => { setReady(false); init(); }} />;

  return (
    <UnreadProvider>
    <NavigationContainer ref={navigationRef}>
      <Root.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.black }, animation: 'fade' }}
      >
        {/* Auth */}
        <Root.Screen name="Onboarding" component={OnboardingScreen} />
        <Root.Screen name="SignUp" component={SignUpScreen} />
        <Root.Screen name="Login" component={LoginScreen} />
        <Root.Screen name="Permissions" component={PermissionsScreen} />

        {/* Main tabs */}
        <Root.Screen name="Main" component={MainTabs} />

        {/* Profile stack — accessible from any tab via navigation.navigate('Profile') */}
        <Root.Screen name="Profile" component={ProfileScreen} />
        <Root.Screen name="MyPosts" component={MyPostsScreen} />
        <Root.Screen name="Bookmarks" component={BookmarksScreen} />
        <Root.Screen name="EditProfile" component={EditProfileScreen} />
        <Root.Screen name="Settings" component={SettingsScreen} />
        <Root.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Root.Screen name="DataUsage" component={DataUsageScreen} />

        {/* Also expose NewPost and PostDetail from root so MyPosts can reach them */}
        <Root.Screen name="NewPost" component={NewPostScreen} />
        <Root.Screen name="PostDetail" component={PostDetailScreen} />

        {/* Messaging */}
        <Root.Screen name="Inbox" component={InboxScreen} />
        <Root.Screen name="Conversation" component={ConversationScreen} />

        {/* Notifications */}
        <Root.Screen name="Notifications" component={NotificationsScreen} />

        {/* GigDetail at root so Conversation/Notification screens can navigate to it */}
        <Root.Screen name="GigDetail" component={GigDetailScreen} />
      </Root.Navigator>
      <NotificationBanner />
    </NavigationContainer>
    </UnreadProvider>
  );
}
