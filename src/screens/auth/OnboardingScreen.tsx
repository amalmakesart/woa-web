import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
  SafeAreaView,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors } from '../../constants/colors';

const { width, height } = Dimensions.get('window');
const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const TOTAL = 5;

const SLIDES = [
  require('../../../assets/onboarding/1.jpg'),
  require('../../../assets/onboarding/2.jpg'),
  require('../../../assets/onboarding/3.jpg'),
  require('../../../assets/onboarding/4.jpg'),
  require('../../../assets/onboarding/5.jpg'),
];

function Progress({ scrollX }: { scrollX: Animated.Value }) {
  const translateX = scrollX.interpolate({
    inputRange: [0, width * (TOTAL - 1)],
    outputRange: [0, 46 * (TOTAL - 1)],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.progressTrack}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <View key={i} style={styles.progressDot} />
      ))}
      <Animated.View style={[styles.progressDotActive, { transform: [{ translateX }] }]} />
    </View>
  );
}

interface Props {
  navigation: any;
}

export default function OnboardingScreen({ navigation }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(nextIndex);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>

        {/* Top bar — skip */}
        <View style={styles.topBar}>
          <Text style={styles.topBarBrand}>WORK(ER) OF ART</Text>
          <TouchableOpacity onPress={() => navigation.replace('SignUp')} activeOpacity={0.7}>
            <Text style={styles.skip}>SKIP</Text>
          </TouchableOpacity>
        </View>

        {/* Slides */}
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
        >
          {SLIDES.map((source, i) => (
            <View key={i} style={styles.slide}>
              <Image source={source} style={styles.image} resizeMode="cover" />
            </View>
          ))}
        </Animated.ScrollView>

        {/* Footer — progress dots + swipe / CTA */}
        <View style={styles.footer}>
          <Progress scrollX={scrollX} />

          <View style={styles.footerRow}>
            <Text style={styles.footerIndex}>
              {String(index + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
            </Text>

            {index < TOTAL - 1 ? (
              <Text style={styles.swipeHint}>SWIPE</Text>
            ) : (
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => navigation.replace('SignUp')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>CREATE ACCOUNT</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  shell: { flex: 1, backgroundColor: colors.black },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topBarBrand: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.18,
  },
  skip: {
    color: '#d6d6d6',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.18,
  },

  slide: {
    width,
    height,
  },
  image: {
    width,
    height,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  progressTrack: {
    width: 184,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 38,
    marginBottom: 18,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressDotActive: {
    position: 'absolute',
    width: 16,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f6c55a',
    left: -4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerIndex: {
    color: '#b5b5b5',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.18,
  },
  swipeHint: {
    color: '#d6d6d6',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.24,
  },
  ctaBtn: {
    backgroundColor: '#f6c55a',
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  ctaText: {
    color: colors.black,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.24,
  },
});
