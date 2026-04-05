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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

const { width } = Dimensions.get('window');
const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const TOTAL = 4;
const GOLD = '#f6c55a';

// ─── WOA Logo (Slide 1) ──────────────────────────────────────────────────────

function WOALogo() {
  return (
    <View style={logo.wrap}>
      <View style={logo.box}>
        <Text style={logo.text}>WORK(ER)</Text>
        <View style={logo.bottomRow}>
          <Text style={logo.text}>OF ART </Text>
          <Text style={logo.dot}>●</Text>
        </View>
      </View>
    </View>
  );
}

const logo = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 40 },
  box: {
    borderWidth: 1,
    borderColor: colors.white,
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.25 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { color: colors.red, fontSize: 13 },
});

// ─── Feed Card Preview (Slide 2) ─────────────────────────────────────────────

function FeedCardPreview() {
  return (
    <View style={feed.card}>
      <View style={feed.header}>
        <View style={feed.avatarWrap}>
          <Ionicons name="person" size={16} color="#555555" />
        </View>
        <View>
          <Text style={feed.name}>Sylvia Plath</Text>
          <Text style={feed.sub}>PAINTER · LONDON</Text>
        </View>
      </View>
      <View style={feed.textPost}>
        <Text style={feed.textContent}>
          I JUST WROTE A POEM, TELL ME WHAT YOU THINK?
        </Text>
      </View>
      <View style={feed.actions}>
        <Text style={feed.action}>♥  12</Text>
        <Text style={feed.action}>◻  4</Text>
      </View>
    </View>
  );
}

const feed = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray1,
    padding: 12,
    width: width * 0.68,
    marginBottom: 36,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarWrap: {
    width: 34,
    height: 34,
    backgroundColor: '#1a1a1a',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  sub: { color: colors.gray6, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18, marginTop: 2 },
  textPost: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 8,
    marginBottom: 10,
  },
  textContent: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.1,
    lineHeight: 12,
  },
  actions: { flexDirection: 'row', gap: 12 },
  action: { color: colors.gray6, fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },
});

// ─── Gig Card Preview (Slide 3) ──────────────────────────────────────────────

function GigCardPreview() {
  return (
    <View style={gigCard.card}>
      <Text style={gigCard.title}>MUSIC VIDEO SHOOT</Text>
      <Text style={gigCard.type}>VIDEOGRAPHER · LONDON</Text>
      <View style={gigCard.row}>
        <Text style={gigCard.budget}>£500–£800</Text>
        <Text style={gigCard.interested}>◉ 7 INTERESTED</Text>
      </View>
    </View>
  );
}

const gigCard = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray1,
    padding: 14,
    width: width * 0.68,
    marginBottom: 36,
  },
  title: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 4 },
  type: { color: colors.gray6, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  budget: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },
  interested: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18 },
});

// ─── Video Preview (Slide 4) ─────────────────────────────────────────────────

function VideoPreview() {
  return (
    <View style={vid.wrap}>
      <View style={vid.thumb}>
        {/* Sky */}
        <View style={vid.sky} />
        {/* Ground */}
        <View style={vid.ground} />
        {/* Mountain left */}
        <View style={vid.mountainLeft} />
        {/* Mountain right */}
        <View style={vid.mountainRight} />
        {/* Play button centered */}
        <View style={vid.playWrap}>
          <View style={vid.playCircle}>
            <Text style={vid.playArrow}>▷</Text>
          </View>
        </View>
      </View>
      <Text style={vid.caption}>FEATURING REAL ARTISTS FROM OUR COMMUNITY</Text>
    </View>
  );
}

const THUMB_W = width * 0.68;
const THUMB_H = 110;

const vid = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 32 },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: THUMB_H * 0.65,
    backgroundColor: '#0a0a0a',
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: THUMB_H * 0.35,
    backgroundColor: '#111111',
  },
  // Left mountain (triangle pointing up) — positioned left of center
  mountainLeft: {
    position: 'absolute',
    bottom: THUMB_H * 0.35 - 1,
    left: THUMB_W * 0.18,
    width: 0,
    height: 0,
    borderLeftWidth: 36,
    borderRightWidth: 36,
    borderBottomWidth: 42,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1c1c1c',
  },
  // Right mountain (taller, right of center)
  mountainRight: {
    position: 'absolute',
    bottom: THUMB_H * 0.35 - 1,
    left: THUMB_W * 0.44,
    width: 0,
    height: 0,
    borderLeftWidth: 44,
    borderRightWidth: 44,
    borderBottomWidth: 54,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#161616',
  },
  playWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playArrow: { color: colors.red, fontSize: 14, marginLeft: 2 },
  caption: {
    color: '#333333',
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.15,
    textAlign: 'center',
    marginTop: 8,
  },
});

// ─── Progress Dots ───────────────────────────────────────────────────────────

function Dots({ active }: { active: number }) {
  return (
    <View style={dot.row}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <View key={i} style={[dot.base, i === active ? dot.on : dot.off]} />
      ))}
    </View>
  );
}

const dot = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, marginBottom: 28 },
  base: { width: 5, height: 5, borderRadius: 2.5 },
  on: { backgroundColor: GOLD },
  off: { backgroundColor: '#333333' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

interface Props { navigation: any }

export default function OnboardingScreen({ navigation }: Props) {
  const [index, setIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const goTo = (next: number) => {
    Animated.timing(translateX, {
      toValue: -next * width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIndex(next));
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.outer}>
        <Animated.View style={[s.track, { transform: [{ translateX }] }]}>

          {/* ── Slide 1 — Find Artists ── */}
          <View style={s.slide}>
            <WOALogo />
            <Text style={s.headline}>FIND ARTISTS</Text>
            <View style={s.divider} />
            <Text style={[s.sub, s.subLarge]}>
              DISCOVER TALENT BY{'\n'}LOCATION & DISCIPLINE
            </Text>
            <Ionicons name="search-outline" size={32} color={colors.white} style={{ marginTop: 20 }} />
          </View>

          {/* ── Slide 2 — Share Your Art ── */}
          <View style={s.slide}>
            <FeedCardPreview />
            <Text style={s.headline}>SHARE YOUR ART</Text>
            <Text style={s.sub}>
              POST IMAGES, TEXT & AUDIO TO THE ART FEED{'\n'}AND LET ARTISTS AND VENUES COMMENT AND SHARE
            </Text>
          </View>

          {/* ── Slide 3 — Get Gigs ── */}
          <View style={s.slide}>
            <GigCardPreview />
            <Text style={s.headline}>GET GIGS</Text>
            <Text style={[s.sub, s.subLarge]}>
              BROWSE REAL WORK POSTED BY{'\n'}LABELS, STUDIOS & BRANDS{'\n'}GET NOTIFIED ABOUT GIGS
            </Text>
            <View style={s.iconRow}>
              <Ionicons name="videocam-outline" size={28} color={colors.white} />
              <Ionicons name="mic-outline" size={28} color={colors.white} />
            </View>
          </View>

          {/* ── Slide 4 — Get Featured ── */}
          <View style={s.slide}>
            <VideoPreview />
            <Text style={s.headline}>GET FEATURED</Text>
            <Text style={s.sub}>
              WE TRAVEL THE WORLD SCOUTING{'\n'}WORKERS OF ART FOR SHORT FILMS
            </Text>
            <View style={s.divider} />
            <Text style={s.micro}>BUILD YOUR PROFILE. WE'LL FIND YOU.</Text>
          </View>

        </Animated.View>

        <View style={s.footer}>
          <Dots active={index} />
          {index < TOTAL - 1 ? (
            <TouchableOpacity style={s.btn} onPress={() => goTo(index + 1)} activeOpacity={0.7}>
              <Text style={s.btnText}>NEXT</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => navigation.replace('SignUp')}
              activeOpacity={0.7}
            >
              <Text style={s.ctaText}>GET STARTED</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  outer: { flex: 1, overflow: 'hidden' },
  track: {
    flex: 1,
    flexDirection: 'row',
    width: width * TOTAL,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 22,
    letterSpacing: 0.25,
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: { width: 40, height: 1, backgroundColor: '#333333', marginBottom: 16 },
  sub: {
    color: GOLD,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.08,
    textAlign: 'center',
    lineHeight: 19,
  },
  subLarge: {
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 22,
  },
  micro: {
    color: GOLD,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.22,
    textAlign: 'center',
    marginTop: 12,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  footer: { alignItems: 'center', paddingBottom: 44, paddingTop: 8 },
  btn: {
    borderWidth: 1,
    borderColor: GOLD,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  btnText: { color: GOLD, fontFamily: MONO, fontSize: 11, letterSpacing: 0.22 },
  ctaBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  ctaText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.22 },
});
