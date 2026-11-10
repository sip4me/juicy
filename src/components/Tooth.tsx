import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type Props = {
  x: number;
  y: number;
  w: number;
  h: number;
  upper: boolean;
  /** jaw progress (0 closed → 1 open) */
  p: SharedValue<number>;
  /** this tooth's own, slightly delayed spring — the difference from p makes it wobble */
  lag: SharedValue<number>;
  /** how far the jaw travels when fully open */
  travel: number;
};

/** One glossy tooth. It rides with its jaw but trails a touch behind, so the row ripples as it opens. */
export function Tooth({ x, y, w, h, upper, p, lag, travel }: Props) {
  const style = useAnimatedStyle(() => {
    const trail = (lag.value - p.value) * travel * 0.32;
    return {
      transform: [
        { translateY: upper ? -trail : trail },
        { scaleY: 1 + Math.abs(lag.value - p.value) * 0.06 },
      ],
    };
  });

  const radius = upper
    ? { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }
    : { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 };

  return (
    <Animated.View
      style={[
        styles.tooth,
        radius,
        { left: x, top: y, width: w, height: h, transformOrigin: upper ? 'top' : 'bottom' },
        upper ? styles.upperShadow : styles.lowerShadow,
        style,
      ]}
    >
      <LinearGradient
        style={[StyleSheet.absoluteFill, radius]}
        colors={upper ? ['#C9C4BC', '#F4F2EE', '#FFFFFF', '#DCD8D2'] : ['#DCD8D2', '#FFFFFF', '#F4F2EE', '#BDB8B0']}
        locations={[0, 0.25, 0.75, 1]}
      />
      {/* side shading for roundness */}
      <LinearGradient
        style={[StyleSheet.absoluteFill, radius]}
        colors={['rgba(120,105,90,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(120,105,90,0.28)']}
        locations={[0, 0.22, 0.7, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      />
      {/* gloss strip */}
      <View
        style={{
          position: 'absolute',
          left: w * 0.18,
          top: upper ? h * 0.42 : h * 0.16,
          width: w * 0.15,
          height: h * 0.4,
          borderRadius: w * 0.08,
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooth: { position: 'absolute', overflow: 'hidden' },
  upperShadow: { boxShadow: '0px 6px 10px rgba(26,10,2,0.45), inset 0px -8px 12px rgba(90,78,68,0.3)' },
  lowerShadow: { boxShadow: '0px -6px 10px rgba(26,10,2,0.45), inset 0px 8px 12px rgba(90,78,68,0.3)' },
});
