import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { HomeIndicator, StatusBarMock } from '../components/StatusBarMock';
import { colors, fonts } from '../theme';

const LOGO = require('../../assets/juicy-mark.png');

/** 00 Splash: the mouth logo pops in, "juicy" rises under it, then hands off to Welcome. */
export function Splash({ onDone }: { onDone: () => void }) {
  const logo = useSharedValue(0);
  const word = useSharedValue(0);

  useEffect(() => {
    logo.value = withSpring(1, { damping: 12, stiffness: 140, mass: 0.9 });
    word.value = withDelay(260, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, logo.value * 1.6),
    transform: [{ scale: 0.82 + 0.18 * logo.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: 18 * (1 - word.value) }],
  }));

  return (
    <View style={styles.screen}>
      <StatusBarMock tint={colors.white} />
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={LOGO} style={styles.logo} resizeMode="cover" />
      </Animated.View>
      <Animated.Text style={[styles.word, wordStyle]}>juicy</Animated.Text>
      <HomeIndicator tint={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.amber },
  logoWrap: { position: 'absolute', left: 45, top: 220, width: 300, height: 300 },
  logo: { width: 300, height: 300 },
  word: {
    position: 'absolute',
    top: 528,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 76,
    lineHeight: 94,
    letterSpacing: -2.3,
    color: colors.cream,
  },
});
