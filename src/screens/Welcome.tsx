import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LowerLip, UpperLip } from '../components/Lips';
import { HomeIndicator, StatusBarMock } from '../components/StatusBarMock';
import { Tooth } from '../components/Tooth';
import { colors, fonts } from '../theme';

// Jaw offsets from the artboard positions below. Closed: the jaws meet with a
// small overbite (upper teeth just in front of the lower ones). Open: they part
// far enough to show the sign-up content.
const UPPER_CLOSED = 87;
const UPPER_OPEN = -95;
const LOWER_CLOSED = -87;
const LOWER_OPEN = 95;
const TRAVEL = UPPER_CLOSED - UPPER_OPEN; // 182 px per jaw

const GAP = 4;
/** Lay a row of teeth out centred on the screen. `bottom` pins lower teeth to their gum line. */
function row(widths: number[], heights: number[], top: number | null, bottom: number | null) {
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (widths.length - 1);
  let x = (390 - total) / 2;
  return widths.map((w, i) => {
    const h = heights[i];
    const t = { x, y: top ?? (bottom as number) - h, w, h };
    x += w + GAP;
    return t;
  });
}

// Real proportions: wide central incisors, narrower laterals, slightly longer canines.
// The tops tuck under the upper lip, so roughly the bottom 85–90 px shows.
const UPPER = row([54, 62, 72, 72, 62, 54], [112, 106, 122, 122, 106, 112], 236, null);
// Lower teeth are smaller and sit behind the uppers; their roots tuck under the lower lip.
/** -1 at the left end of a row, 0 in the middle, 1 at the right end. */
const archPos = (i: number, n: number) => (i - (n - 1) / 2) / ((n - 1) / 2);

const LOWER = row([56, 60, 62, 62, 60, 56], [100, 94, 98, 98, 94, 100], null, 620);

// The whole opening is one spring. Everything else is derived from it, so jaws,
// lips, mouth and text can never drift out of sync.
const CLENCH = -0.045; // tiny bite before it opens (anticipation)
const OPEN_SPRING = { damping: 13, stiffness: 115, mass: 1 };
const TOOTH_SPRING = { damping: 8.5, stiffness: 125, mass: 0.8 };
const CLOSE_TIMING = { duration: 260, easing: Easing.in(Easing.cubic) };

function useLags(n: number) {
  // fixed-length list of shared values, one per tooth
  const a = useSharedValue(0), b = useSharedValue(0), c = useSharedValue(0);
  const d = useSharedValue(0), e = useSharedValue(0), f = useSharedValue(0);
  return [a, b, c, d, e, f].slice(0, n);
}

type Props = { onJoin: () => void; quickOpen?: boolean };

/** 01 Welcome: a mouth that bites, then springs open to reveal the sign-up choices. */
export function Welcome({ onJoin, quickOpen = false }: Props) {
  const p = useSharedValue(0);
  const upperLags = useLags(UPPER.length);
  const lowerLags = useLags(LOWER.length);
  const state = useRef<'closed' | 'opening' | 'open' | 'closing'>('closed');

  const animateTeeth = (lags: SharedValue<number>[], to: number, center: number) => {
    lags.forEach((lag, i) => {
      const delay = Math.abs(i - center) * 26; // ripple from the middle outwards
      lag.value =
        to === 1
          ? withSequence(withTiming(CLENCH, { duration: 150 }), withDelay(delay, withSpring(1, TOOTH_SPRING)))
          : withTiming(0, CLOSE_TIMING);
    });
  };

  const open = () => {
    if (state.current !== 'closed') return;
    state.current = 'opening';
    p.value = withSequence(
      withTiming(CLENCH, { duration: 150, easing: Easing.out(Easing.quad) }),
      withSpring(1, OPEN_SPRING),
    );
    animateTeeth(upperLags, 1, (UPPER.length - 1) / 2);
    animateTeeth(lowerLags, 1, (LOWER.length - 1) / 2);
    if (Platform.OS !== 'web') {
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150);
    }
    setTimeout(() => (state.current = 'open'), 700);
  };

  const join = () => {
    if (state.current === 'closing') return;
    state.current = 'closing';
    // chomp shut, then move on
    p.value = withTiming(0, CLOSE_TIMING);
    animateTeeth(upperLags, 0, 2);
    animateTeeth(lowerLags, 0, 2.5);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(onJoin, 300);
  };

  useEffect(() => {
    const t = setTimeout(open, quickOpen ? 250 : 900);
    return () => clearTimeout(t);
  }, []);

  // ---- derived styles ----
  const upperJaw = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0, 1], [UPPER_CLOSED, UPPER_OPEN]) }],
  }));
  const lowerJaw = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0, 1], [LOWER_CLOSED, LOWER_OPEN]) }],
  }));
  // the wordmark rides up with the top lip and fades before it reaches the status bar
  const wordmark = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.2, 0.55], [1, 0], Extrapolation.CLAMP),
  }));

  // lips stretch a little while the mouth is mid-open, then relax
  const lipStretch = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(p.value, [CLENCH, 0, 0.5, 1], [1.02, 1, 1.015, 1]) },
      { scaleY: interpolate(p.value, [CLENCH, 0, 0.5, 1], [1.05, 1, 0.95, 1]) },
    ],
  }));

  const mouth = useAnimatedStyle(() => ({
    top: interpolate(p.value, [0, 1], [320, 40], Extrapolation.CLAMP),
    height: interpolate(p.value, [0, 1], [220, 760], Extrapolation.CLAMP),
  }));

  const hint = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Pressable style={styles.screen} onPress={open}>
      <StatusBarMock tint={colors.white} />

      {/* inside of the mouth */}
      <Animated.View style={[styles.mouth, mouth]}>
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={['#120500', '#3A1606', '#4A1E08', '#3A1606', '#120500']}
          locations={[0, 0.25, 0.5, 0.75, 1]}
        />
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
          locations={[0, 0.2, 0.8, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </Animated.View>

      {/* what the mouth reveals */}
      <Reveal p={p} index={0} style={styles.titleWrap}>
        <Text style={styles.title}>Welcome to Juicy</Text>
      </Reveal>
      <Reveal p={p} index={1} style={styles.subWrap}>
        <Text style={styles.sub}>{'Your tongue has opinions.\nLet’s finally hear them.'}</Text>
      </Reveal>
      <Reveal p={p} index={2} style={styles.btnWrap}>
        <PressScale onPress={join}>
          <LinearGradient colors={['#FF8A4E', '#E8501A']} style={styles.btn}>
            <Text style={styles.btnText}>Join Juicy</Text>
          </LinearGradient>
        </PressScale>
      </Reveal>
      <Reveal p={p} index={3} style={styles.linkWrap}>
        <PressScale onPress={() => {}}>
          <Text style={styles.link}>I already have an account</Text>
        </PressScale>
      </Reveal>

      {/* LOWER JAW (drawn first so the upper teeth overlap it: a natural overbite) */}
      <Animated.View style={[StyleSheet.absoluteFill, lowerJaw]} pointerEvents="none">
        {LOWER.map((t, i) => (
          <Tooth key={i} {...t} arch={archPos(i, LOWER.length)} upper={false} p={p} lag={lowerLags[i]} travel={TRAVEL} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, lipStretch, { transformOrigin: '50% 645px', zIndex: 20 }]}>
          <LowerLip />
        </Animated.View>
        <Animated.Text style={[styles.hint, hint]}>Open wide…</Animated.Text>
      </Animated.View>

      {/* UPPER JAW */}
      <Animated.View style={[StyleSheet.absoluteFill, upperJaw]} pointerEvents="none">
        <Animated.Text style={[styles.wordmark, wordmark]}>juicy</Animated.Text>
        {UPPER.map((t, i) => (
          <Tooth key={i} {...t} arch={archPos(i, UPPER.length)} upper p={p} lag={upperLags[i]} travel={TRAVEL} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, lipStretch, { transformOrigin: '50% 215px', zIndex: 20 }]}>
          <UpperLip />
        </Animated.View>
      </Animated.View>

      <HomeIndicator tint={colors.white} />
    </Pressable>
  );
}

/** Fades and rises into place once the jaws are far enough apart, one after another. */
function Reveal({ p, index, style, children }: { p: SharedValue<number>; index: number; style: object; children: React.ReactNode }) {
  const a = useAnimatedStyle(() => {
    const start = 0.42 + index * 0.08;
    const t = interpolate(p.value, [start, start + 0.32], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: t,
      transform: [{ translateY: 26 * (1 - t) }, { scale: 0.94 + 0.06 * t }],
    };
  });
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Springy press feedback for buttons. */
function PressScale({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPressIn={() => (s.value = withSpring(0.95, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 10, stiffness: 300 }))}
      onPress={onPress}
    >
      <Animated.View style={a}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.amber, overflow: 'hidden' },
  mouth: { position: 'absolute', left: 0, width: 390, overflow: 'hidden' },
  titleWrap: { position: 'absolute', top: 292, left: 0, right: 0, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 44, letterSpacing: -0.7, color: colors.cream },
  subWrap: { position: 'absolute', top: 346, left: 0, right: 0, alignItems: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, textAlign: 'center', color: 'rgba(255,226,200,0.8)' },
  btnWrap: { position: 'absolute', top: 420, left: 50, width: 290 },
  btn: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 18px rgba(0,0,0,0.35), inset 0px 3px 6px rgba(255,255,255,0.45)',
  },
  btnText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
  linkWrap: { position: 'absolute', top: 496, left: 0, right: 0, alignItems: 'center' },
  link: { fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,244,234,0.85)', textDecorationLine: 'underline', padding: 6 },
  wordmark: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 56,
    letterSpacing: -1,
    color: colors.cream,
  },
  hint: {
    position: 'absolute',
    top: 760,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 15,
    color: 'rgba(255,226,200,0.85)',
  },
});
