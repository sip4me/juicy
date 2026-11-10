import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type Props = {
  x: number;
  y: number;
  w: number;
  h: number;
  upper: boolean;
  /** where the tooth sits in the arch: -1 = far left, 0 = centre, 1 = far right */
  arch: number;
  /** jaw progress (0 closed → 1 open) */
  p: SharedValue<number>;
  /** this tooth's own, slightly delayed spring — the difference from p makes it wobble */
  lag: SharedValue<number>;
  /** how far the jaw travels when fully open */
  travel: number;
};

const ARCH_TURN = 34; // degrees the outermost teeth turn away (the curve of the dental arch)
const DEPTH = 7; // px of visible tooth thickness

/**
 * One 3D tooth. Built in layers, back to front:
 *   thickness slab → enamel body → rounded side shading → root shadow →
 *   translucent biting edge → rim light → specular highlights.
 * It turns in perspective according to its place in the arch, rides with its
 * jaw, and trails a touch behind so the row ripples as the mouth opens.
 */
export function Tooth({ x, y, w, h, upper, arch, p, lag, travel }: Props) {
  const turn = arch * ARCH_TURN;
  const away = Math.abs(arch); // 0 at the centre, 1 at the ends of the row

  const motion = useAnimatedStyle(() => {
    const trail = (lag.value - p.value) * travel * 0.32;
    return {
      transform: [
        { perspective: 520 },
        { translateY: upper ? -trail : trail },
        { rotateY: `${turn}deg` },
        { scaleY: 1 + Math.abs(lag.value - p.value) * 0.06 },
      ],
    };
  });

  const radius = upper
    ? { borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: w * 0.36, borderBottomRightRadius: w * 0.36 }
    : { borderTopLeftRadius: w * 0.34, borderTopRightRadius: w * 0.34, borderBottomLeftRadius: 9, borderBottomRightRadius: 9 };

  // the side of the tooth turned away from the viewer is the shaded one
  const darkLeft = arch < 0 ? 0.42 + away * 0.25 : 0.3;
  const darkRight = arch > 0 ? 0.42 + away * 0.25 : 0.3;
  const peak = 0.38 - arch * 0.12; // where the light sits across the face

  return (
    <Animated.View
      style={[
        styles.wrap,
        { left: x, top: y, width: w, height: h, transformOrigin: upper ? 'top' : 'bottom' },
        motion,
      ]}
    >
      {/* thickness: the back of the tooth peeking out below/above and towards the centre */}
      <View
        style={[
          styles.fill,
          radius,
          {
            transform: [{ translateY: upper ? DEPTH : -DEPTH }, { translateX: -arch * 4 }],
            backgroundColor: '#9C9184',
            boxShadow: upper
              ? '0px 10px 14px rgba(20,6,0,0.55)'
              : '0px -10px 14px rgba(20,6,0,0.55)',
          },
        ]}
      />

      <View style={[styles.fill, radius, styles.clip]}>
        {/* enamel body: warm ivory, brightest in the middle third */}
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={upper ? ['#D8CFC2', '#F6F2EA', '#FFFFFF', '#EEE9E1'] : ['#ECE6DC', '#FFFFFF', '#F3EEE6', '#CFC5B8']}
          locations={[0, 0.3, 0.62, 1]}
        />
        {/* rounded sides: dark edges, light peak, turned-away side darker */}
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={[
            `rgba(92,74,58,${darkLeft})`,
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.35)',
            'rgba(255,255,255,0)',
            `rgba(92,74,58,${darkRight})`,
          ]}
          locations={[0, Math.max(0.05, peak - 0.24), peak, Math.min(0.95, peak + 0.3), 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
        {/* root sits in the shadow of the lip */}
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={upper ? ['rgba(90,40,10,0.45)', 'rgba(90,40,10,0)'] : ['rgba(90,40,10,0)', 'rgba(90,40,10,0.45)']}
          locations={upper ? [0, 0.38] : [0.62, 1]}
        />
        {/* translucent biting edge (real enamel goes slightly blue-grey here) */}
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={
            upper
              ? ['rgba(150,170,190,0)', 'rgba(150,170,190,0.38)']
              : ['rgba(150,170,190,0.34)', 'rgba(150,170,190,0)']
          }
          locations={upper ? [0.72, 1] : [0, 0.26]}
        />
        {/* rim light along the biting edge */}
        <View
          style={[
            styles.rim,
            upper ? { bottom: 2, borderBottomLeftRadius: w * 0.36, borderBottomRightRadius: w * 0.36, borderBottomWidth: 2 } : { top: 2, borderTopLeftRadius: w * 0.34, borderTopRightRadius: w * 0.34, borderTopWidth: 2 },
          ]}
        />
        {/* soft wide highlight */}
        <View
          style={{
            position: 'absolute',
            left: w * (peak - 0.2),
            top: upper ? h * 0.36 : h * 0.12,
            width: w * 0.34,
            height: h * 0.46,
            borderRadius: w * 0.17,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }}
        />
        {/* sharp specular */}
        <View
          style={{
            position: 'absolute',
            left: w * (peak - 0.12),
            top: upper ? h * 0.44 : h * 0.18,
            width: w * 0.12,
            height: h * 0.28,
            borderRadius: w * 0.06,
            backgroundColor: 'rgba(255,255,255,0.95)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: w * (peak + 0.06),
            top: upper ? h * 0.8 : h * 0.1,
            width: w * 0.08,
            height: w * 0.08,
            borderRadius: w * 0.04,
            backgroundColor: 'rgba(255,255,255,0.8)',
          }}
        />
      </View>
      {/* faint outline so neighbouring teeth separate */}
      <View pointerEvents="none" style={[styles.fill, radius, styles.edge]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  clip: { overflow: 'hidden' },
  rim: { position: 'absolute', left: 3, right: 3, height: 14, borderColor: 'rgba(255,255,255,0.75)' },
  edge: { borderWidth: 1, borderColor: 'rgba(110,90,70,0.28)' },
});
