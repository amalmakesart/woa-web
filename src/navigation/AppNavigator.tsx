import React, { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator, TouchableOpacity, Platform, StyleSheet, Animated, Easing, Alert, Linking } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalSupabaseSession, isInvalidRefreshTokenError, supabase } from '../lib/supabase';
import { colors } from '../constants/colors';
import { navigationRef } from '../lib/navigationRef';
import NotificationBanner from '../components/NotificationBanner';
import { completePendingSignupExperience } from '../lib/signupRecovery';

// Auth
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import PermissionsScreen from '../screens/auth/PermissionsScreen';

// Context
import { UnreadProvider } from '../contexts/UnreadContext';

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#000000' },
} as const;

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const ONBOARDING_KEY = '@woa_onboarding_seen';

type PendingExternalRoute = {
  name: 'PostDetail' | 'ArtistProfile';
  params: Record<string, unknown>;
} | null;

const getFeedScreen = () => require('../screens/feed/FeedScreen').default;
const getPostDetailScreen = () => require('../screens/feed/PostDetailScreen').default;
const getNewPostScreen = () => require('../screens/feed/NewPostScreen').default;
const getArtistsScreen = () => require('../screens/artists/ArtistsScreen').default;
const getArtistProfileScreen = () => require('../screens/artists/ArtistProfileScreen').default;
const getGigsScreen = () => require('../screens/gigs/GigsScreen').default;
const getGigDetailScreen = () => require('../screens/gigs/GigDetailScreen').default;
const getExpressInterestScreen = () => require('../screens/gigs/ExpressInterestScreen').default;
const getPostGigScreen = () => require('../screens/gigs/PostGigScreen').default;
const getInterestedArtistsScreen = () => require('../screens/gigs/InterestedArtistsScreen').default;
const getFeaturesScreen = () => require('../screens/features/FeaturesScreen').default;
const getFilmDetailScreen = () => require('../screens/features/FilmDetailScreen').default;
const getAddFeatureScreen = () => require('../screens/features/AddFeatureScreen').default;
const getFeatureInterestsScreen = () => require('../screens/features/FeatureInterestsScreen').default;
const getInboxScreen = () => require('../screens/messaging/InboxScreen').default;
const getConversationScreen = () => require('../screens/messaging/ConversationScreen').default;
const getNotificationsScreen = () => require('../screens/notifications/NotificationsScreen').default;
const getWelcomeMessageScreen = () => require('../screens/notifications/WelcomeMessageScreen').default;
const getModerationScreen = () => require('../screens/admin/ModerationScreen').default;
const getSearchScreen = () => require('../screens/search/SearchScreen').default;
const getProfileScreen = () => require('../screens/profile/ProfileScreen').default;
const getMyPostsScreen = () => require('../screens/profile/MyPostsScreen').default;
const getBookmarksScreen = () => require('../screens/profile/BookmarksScreen').default;
const getFollowListScreen = () => require('../screens/profile/FollowListScreen').default;
const getEditProfileScreen = () => require('../screens/profile/EditProfileScreen').default;
const getSettingsScreen = () => require('../screens/profile/SettingsScreen').default;
const getDeleteAccountScreen = () => require('../screens/profile/DeleteAccountScreen').default;
const getDataUsageScreen = () => require('../screens/profile/DataUsageScreen').default;
const getManagePortfolioScreen = () => require('../screens/profile/ManagePortfolioScreen').default;
const getManageShowsScreen = () => require('../screens/profile/ManageShowsScreen').default;
const getLeaveReviewScreen = () => require('../screens/gigs/LeaveReviewScreen').default;
const getProjectsScreen = () => require('../screens/projects/ProjectsScreen').default;
const getPostProjectScreen = () => require('../screens/projects/PostProjectScreen').default;
const getProjectDetailScreen = () => require('../screens/projects/ProjectDetailScreen').default;

function parseExternalRoute(url: string): PendingExternalRoute {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const schemeParts = parsed.protocol === 'workerofart:'
      ? [parsed.hostname, ...pathParts]
      : pathParts;

    if (schemeParts[0] === 'post' && schemeParts[1]) {
      return { name: 'PostDetail', params: { postId: schemeParts[1] } };
    }

    if ((schemeParts[0] === 'profile' || schemeParts[0] === 'artist') && schemeParts[1]) {
      return { name: 'ArtistProfile', params: { userId: schemeParts[1] } };
    }

    if (schemeParts[0] === 'share' && schemeParts[1] === 'post' && schemeParts[2]) {
      return { name: 'PostDetail', params: { postId: schemeParts[2] } };
    }

    if (schemeParts[0] === 'share' && (schemeParts[1] === 'profile' || schemeParts[1] === 'artist') && schemeParts[2]) {
      return { name: 'ArtistProfile', params: { userId: schemeParts[2] } };
    }
  } catch {
    return null;
  }

  return null;
}

// Feed Stack
const FeedStack = createNativeStackNavigator();
function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <FeedStack.Screen name="FeedMain" getComponent={getFeedScreen} />
      <FeedStack.Screen name="PostDetail" getComponent={getPostDetailScreen} />
      <FeedStack.Screen name="NewPost" getComponent={getNewPostScreen} />
      <FeedStack.Screen name="ArtistProfile" getComponent={getArtistProfileScreen} />
    </FeedStack.Navigator>
  );
}

// Artists Stack
const ArtistsStack = createNativeStackNavigator();
function ArtistsNavigator() {
  return (
    <ArtistsStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <ArtistsStack.Screen name="ArtistsMain" getComponent={getArtistsScreen} />
      <ArtistsStack.Screen name="ArtistProfile" getComponent={getArtistProfileScreen} />
      <ArtistsStack.Screen name="PostDetail" getComponent={getPostDetailScreen} />
    </ArtistsStack.Navigator>
  );
}

// Gigs Stack
const GigsStack = createNativeStackNavigator();
function GigsNavigator() {
  return (
    <GigsStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <GigsStack.Screen name="GigsMain" getComponent={getGigsScreen} />
      <GigsStack.Screen name="GigDetail" getComponent={getGigDetailScreen} />
      <GigsStack.Screen name="ExpressInterest" getComponent={getExpressInterestScreen} />
      <GigsStack.Screen name="PostGig" getComponent={getPostGigScreen} />
      <GigsStack.Screen name="InterestedArtists" getComponent={getInterestedArtistsScreen} />
      <GigsStack.Screen name="ArtistProfile" getComponent={getArtistProfileScreen} />
      <GigsStack.Screen name="LeaveReview" getComponent={getLeaveReviewScreen} />
    </GigsStack.Navigator>
  );
}

// Features Stack
const FeaturesStack = createNativeStackNavigator();
function FeaturesNavigator() {
  return (
    <FeaturesStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <FeaturesStack.Screen name="FeaturesMain" getComponent={getFeaturesScreen} />
      <FeaturesStack.Screen name="FilmDetail" getComponent={getFilmDetailScreen} />
      <FeaturesStack.Screen name="AddFeature" getComponent={getAddFeatureScreen} />
      <FeaturesStack.Screen name="FeatureInterests" getComponent={getFeatureInterestsScreen} />
      <FeaturesStack.Screen name="ArtistProfile" getComponent={getArtistProfileScreen} />
    </FeaturesStack.Navigator>
  );
}

// Projects Stack
const ProjectsStack = createNativeStackNavigator();
function ProjectsNavigator() {
  return (
    <ProjectsStack.Navigator screenOptions={SCREEN_OPTIONS}>
      <ProjectsStack.Screen name="ProjectsMain" getComponent={getProjectsScreen} />
      <ProjectsStack.Screen name="ProjectDetail" getComponent={getProjectDetailScreen} />
      <ProjectsStack.Screen name="PostProject" getComponent={getPostProjectScreen} />
      <ProjectsStack.Screen name="ArtistProfile" getComponent={getArtistProfileScreen} />
    </ProjectsStack.Navigator>
  );
}

// Tab Navigator — order: Features · Artists · Feed · Gigs · Projects
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.black, borderTopWidth: 1, borderTopColor: colors.gray2 },
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.gray4,
        tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.18 },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'Features') return <Ionicons name={focused ? 'play-circle' : 'play-circle-outline'} size={22} color={color} />;
          if (route.name === 'Artists')  return <Ionicons name={focused ? 'stop' : 'stop-outline'} size={22} color={color} />;
          if (route.name === 'Feed')     return <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />;
          if (route.name === 'Gigs')     return <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />;
          if (route.name === 'Projects') return <Ionicons name={focused ? 'layers' : 'layers-outline'} size={22} color={color} />;
          return null;
        },
      })}
    >
      <Tab.Screen name="Features" component={FeaturesNavigator} />
      <Tab.Screen name="Artists"  component={ArtistsNavigator} />
      <Tab.Screen name="Feed"     component={FeedNavigator} />
      <Tab.Screen name="Gigs"     component={GigsNavigator} />
      <Tab.Screen name="Projects" component={ProjectsNavigator} options={{ tabBarLabel: 'Collab' }} />
    </Tab.Navigator>
  );
}

// Splash Screen
function SplashScreen() {
  const opacity    = React.useRef(new Animated.Value(0)).current;
  const scale      = React.useRef(new Animated.Value(0.88)).current;
  const dotOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scale,      { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(dotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={sp.wrap}>
      <Animated.View style={[sp.logoWrap, { opacity, transform: [{ scale }] }]}>
        <View style={sp.box}>
          <Text style={sp.line}>WORK(ER)</Text>
          <View style={sp.row}>
            <Text style={sp.line}>OF ART </Text>
            <Animated.Text style={[sp.dot, { opacity: dotOpacity }]}>●</Animated.Text>
          </View>
        </View>
        <Animated.Text style={[sp.tagline, { opacity: dotOpacity }]}>
          THE PLATFORM FOR WORKING ARTISTS
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  logoWrap:{ alignItems: 'center' },
  box:     { borderWidth: 1, borderColor: colors.white, width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  line:    { color: colors.white, fontFamily: MONO, fontSize: 15, letterSpacing: 0.3 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  dot:     { color: colors.red, fontSize: 15 },
  tagline: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.3 },
});

// No Internet Screen
function NoInternetScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={ni.wrap}>
      <Text style={ni.title}>NO CONNECTION</Text>
      <Text style={ni.sub}>PLEASE CHECK YOUR NETWORK</Text>
      <TouchableOpacity style={ni.btn} onPress={onRetry} activeOpacity={0.7}>
        <Text style={ni.btnText}>TRY AGAIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const ni = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  title:   { color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.3, marginBottom: 10 },
  sub:     { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 28 },
  btn:     { borderWidth: 1, borderColor: '#c0392b', paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#c0392b', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
});

// Root Navigator
const Root = createNativeStackNavigator();

export default function AppNavigator() {
  const [ready, setReady]             = useState(false);
  const [showSplash, setShowSplash]   = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('Onboarding');
  const [noInternet, setNoInternet]   = useState(false);
  const [pendingExternalRoute, setPendingExternalRoute] = useState<PendingExternalRoute>(null);

  const openPendingExternalRoute = (route: PendingExternalRoute) => {
    if (!route) return;

    if (navigationRef.isReady()) {
      navigationRef.resetRoot({
        index: 1,
        routes: [
          { name: 'Main' as never },
          { name: route.name as never, params: route.params as never },
        ],
      });
      return;
    }

    setPendingExternalRoute(route);
  };

  const finishAuthRedirect = async (url: string | null) => {
    if (!url) return;

    try {
      const parsed = new URL(url);
      const appRoute = parseExternalRoute(url);
      if (appRoute) {
        openPendingExternalRoute(appRoute);
        return;
      }
      const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');
      const queryParams = new URLSearchParams(parsed.search.startsWith('?') ? parsed.search.slice(1) : '');
      const params = hashParams.size > 0 ? hashParams : queryParams;

      const errorDescription = params.get('error_description') ?? params.get('error');
      if (errorDescription) {
        Alert.alert('CONFIRMATION ERROR', decodeURIComponent(errorDescription).toUpperCase());
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          Alert.alert('CONFIRMATION ERROR', error.message.toUpperCase());
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          Alert.alert('CONFIRMATION ERROR', error.message.toUpperCase());
          return;
        }
      } else {
        return;
      }

      await completePendingSignupExperience();
      setInitialRoute('Main');
      setReady(true);
      if (navigationRef.isReady()) {
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    } catch {
      Alert.alert('CONFIRMATION ERROR', 'WE COULD NOT OPEN THE CONFIRMATION LINK.');
    }
  };

  const init = async () => {
    setNoInternet(false);
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) { setNoInternet(true); setReady(true); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await completePendingSignupExperience();
        setInitialRoute('Main');
        setReady(true);
        return;
      }
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      setInitialRoute(seen === 'true' ? 'SignUp' : 'Onboarding');
      if (seen !== 'true') await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearLocalSupabaseSession();
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setInitialRoute(seen === 'true' ? 'SignUp' : 'Onboarding');
      } else {
        setInitialRoute('Onboarding');
      }
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    init();
    Linking.getInitialURL().then(finishAuthRedirect).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      finishAuthRedirect(url);
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !pendingExternalRoute || !navigationRef.isReady()) return;

    navigationRef.resetRoot({
      index: 1,
      routes: [
        { name: 'Main' as never },
        { name: pendingExternalRoute.name as never, params: pendingExternalRoute.params as never },
      ],
    });
    setPendingExternalRoute(null);
  }, [ready, pendingExternalRoute]);

  if (showSplash || !ready) return <SplashScreen />;
  if (noInternet) return <NoInternetScreen onRetry={() => { setReady(false); setShowSplash(true); init(); }} />;

  return (
    <UnreadProvider>
      <NavigationContainer ref={navigationRef}>
        <Root.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.black }, animation: 'fade' }}
        >
          <Root.Screen name="Onboarding"    component={OnboardingScreen} />
          <Root.Screen name="SignUp"        component={SignUpScreen} />
          <Root.Screen name="Login"         component={LoginScreen} />
          <Root.Screen name="Permissions"   component={PermissionsScreen} />
          <Root.Screen name="Main"          component={MainTabs} />
          <Root.Screen name="Search"        getComponent={getSearchScreen} />
          <Root.Screen name="Profile"       getComponent={getProfileScreen} />
          <Root.Screen name="MyPosts"       getComponent={getMyPostsScreen} />
          <Root.Screen name="Bookmarks"     getComponent={getBookmarksScreen} />
          <Root.Screen name="FollowList"    getComponent={getFollowListScreen} />
          <Root.Screen name="EditProfile"   getComponent={getEditProfileScreen} />
          <Root.Screen name="Settings"      getComponent={getSettingsScreen} />
          <Root.Screen name="DeleteAccount" getComponent={getDeleteAccountScreen} />
          <Root.Screen name="DataUsage"     getComponent={getDataUsageScreen} />
          <Root.Screen name="NewPost"       getComponent={getNewPostScreen} />
          <Root.Screen name="PostDetail"    getComponent={getPostDetailScreen} />
          <Root.Screen name="ArtistProfile" getComponent={getArtistProfileScreen} />
          <Root.Screen name="Inbox"         getComponent={getInboxScreen} />
          <Root.Screen name="Conversation"  getComponent={getConversationScreen} />
          <Root.Screen name="Notifications" getComponent={getNotificationsScreen} />
          <Root.Screen name="WelcomeMessage" getComponent={getWelcomeMessageScreen} />
          <Root.Screen name="Moderation"    getComponent={getModerationScreen} />
          <Root.Screen name="GigDetail"        getComponent={getGigDetailScreen} />
          <Root.Screen name="ManagePortfolio" getComponent={getManagePortfolioScreen} />
          <Root.Screen name="ManageShows"     getComponent={getManageShowsScreen} />
          <Root.Screen name="LeaveReview"     getComponent={getLeaveReviewScreen} />
          <Root.Screen name="ProjectDetail"   getComponent={getProjectDetailScreen} />
          <Root.Screen name="PostProject"     getComponent={getPostProjectScreen} />
        </Root.Navigator>
        <NotificationBanner />
      </NavigationContainer>
    </UnreadProvider>
  );
}
