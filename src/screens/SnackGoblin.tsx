import { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { HomeIndicator, StatusBarMock } from '../components/StatusBarMock';
import { colors, fonts } from '../theme';

type Goblin = {
  id: string;
  title: string;
  line: string;
  icon: ImageSourcePropType;
  chip: string;
  cx: number; // card centre on the artboard (from Figma)
  cy: number;
  rot: number;
};

const GOBLINS: Goblin[] = [
  { id: 'cereal', title: 'Midnight cereal gremlin', line: 'Kitchen opens at 2am', icon: require('../../assets/food/cereal.png'), chip: '#FFF1C9', cx: 114, cy: 325, rot: 6 },
  { id: 'salt', title: 'Salt goblin', line: "Has never met a fry it didn't love", icon: require('../../assets/food/salt.png'), chip: '#E4ECFF', cx: 276, cy: 374, rot: -5 },
  { id: 'leftover', title: 'Leftover lord', line: 'Cold pizza is breakfast', icon: require('../../assets/food/bento.png'), chip: '#FFE3EA', cx: 126, cy: 515, rot: -4 },
  { id: 'dessert', title: 'Dessert first', line: 'Life is short. Cake now.', icon: require('../../assets/food/cake.png'), chip: '#EFE6FF', cx: 286, cy: 554, rot: 5 },
];

const CARD_W = 178;
const CARD_H = 150;

/** 02 Snack goblin: pick the snacker you are. */
export function SnackGoblin({ onBack }: { onBack: () => void }) {
  const [picked, setPicked] = useState('salt');

  const choose = (id: string) => {
    setPicked(id);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };

  return (
    <View style={styles.screen}>
      <StatusBarMock />

      {/* header */}
      <Animated.View entering={FadeInDown.duration(380).delay(80)} style={styles.header}>
        <PressScale onPress={onBack} style={styles.back}>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path d="M10 3 L5 8 L10 13" stroke={colors.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </PressScale>
        <Text style={styles.step}>1 of 6</Text>
        <PressScale onPress={() => {}} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </PressScale>
      </Animated.View>

      <Animated.Text entering={FadeInDown.duration(420).delay(140)} style={styles.title}>
        {'What kind of\nsnack goblin are you?'}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.duration(420).delay(200)} style={styles.sub}>
        There are no wrong answers. Only hungry ones.
      </Animated.Text>

      {/* cards */}
      {GOBLINS.map((g, i) => (
        <Animated.View
          key={g.id}
          entering={ZoomIn.springify().damping(14).stiffness(140).delay(260 + i * 70)}
          style={{ position: 'absolute', left: g.cx - CARD_W / 2, top: g.cy - CARD_H / 2, width: CARD_W, height: CARD_H }}
        >
          <Card g={g} selected={picked === g.id} onPress={() => choose(g.id)} />
        </Animated.View>
      ))}

      <Animated.Text entering={ZoomIn.delay(620)} style={styles.sparkle}>
        ✨
      </Animated.Text>
      <Floaty />

      {/* next */}
      <Animated.View entering={ZoomIn.springify().damping(12).delay(700)} style={styles.nextWrap}>
        <Svg width={84} height={84} viewBox="0 0 84 84" style={StyleSheet.absoluteFill}>
          <Circle cx={42} cy={42} r={38} stroke="#EDEDED" strokeWidth={4} fill="none" />
          <Path d="M42 2 V8 M82 42 H76 M42 82 V76 M2 42 H8" stroke="#FFC20E" strokeWidth={4} strokeLinecap="round" />
        </Svg>
        <PressScale onPress={() => {}} style={styles.next}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d="M5 12 H19 M13 6 L19 12 L13 18" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </PressScale>
      </Animated.View>

      <HomeIndicator />
    </View>
  );
}

function Card({ g, selected, onPress }: { g: Goblin; selected: boolean; onPress: () => void }) {
  const s = useSharedValue(1);
  const lift = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, { damping: 12, stiffness: 180 });
    if (selected) s.value = withSequence(withTiming(0.96, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 }));
  }, [selected]);

  const a = useAnimatedStyle(() => ({
    transform: [{ rotate: `${g.rot}deg` }, { scale: s.value * (1 + lift.value * 0.03) }, { translateY: -6 * lift.value }],
  }));

  return (
    <Pressable
      onPressIn={() => (s.value = withSpring(0.96, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 10, stiffness: 300 }))}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.card, selected && styles.cardOn, a]}>
        <View style={[styles.chip, { backgroundColor: g.chip }]}>
          <Image source={g.icon} style={styles.icon} />
        </View>
        <Text style={styles.cardTitle}>{g.title}</Text>
        <Text style={styles.cardLine}>{g.line}</Text>
        {selected ? (
          <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.badge}>
            <Svg width={15} height={15} viewBox="0 0 15 15">
              <Circle cx={5} cy={5.5} r={1.2} fill={colors.ink} />
              <Circle cx={10} cy={5.5} r={1.2} fill={colors.ink} />
              <Path d="M4 9 Q7.5 12.5 11 9" stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** The little fries that bob in the corner. */
function Floaty() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(800, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * t.value }, { rotate: `${-8 + 6 * t.value}deg` }],
  }));
  return (
    <Animated.View entering={ZoomIn.delay(680)} style={styles.fries}>
      <Animated.View style={a}>
        <Image source={require('../../assets/food/fries.png')} style={{ width: 53, height: 53, mixBlendMode: 'multiply' }} />
      </Animated.View>
    </Animated.View>
  );
}

function PressScale({ onPress, style, children }: { onPress: () => void; style?: object; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPressIn={() => (s.value = withSpring(0.9, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 10, stiffness: 300 }))}
      onPress={onPress}
    >
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: { position: 'absolute', top: 57, left: 20, right: 20, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: fonts.medium, fontSize: 11, color: colors.grey },
  skip: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink },
  title: { position: 'absolute', top: 118, left: 24, right: 24, textAlign: 'center', fontFamily: fonts.medium, fontSize: 23, lineHeight: 28, color: colors.ink },
  sub: { position: 'absolute', top: 182, left: 80, right: 80, textAlign: 'center', fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.grey },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 3,
    borderColor: 'transparent',
    boxShadow: '0px 10px 26px rgba(0,0,0,0.09), 0px 2px 6px rgba(0,0,0,0.05)',
  },
  cardOn: { borderColor: colors.ink, boxShadow: '0px 14px 30px rgba(0,0,0,0.14)' },
  chip: {
    width: 52,
    height: 52,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.08)',
  },
  icon: { width: 44, height: 44, mixBlendMode: 'multiply' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19, color: colors.ink },
  cardLine: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, lineHeight: 15, color: colors.grey },
  badge: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 30,
    height: 30,
    borderRadius: 14,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: { position: 'absolute', left: 320, top: 232, fontSize: 22 },
  fries: { position: 'absolute', left: 29, top: 629 },
  nextWrap: { position: 'absolute', left: 153, top: 702, width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  next: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
