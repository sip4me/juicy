import { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { fonts, SCREEN_H, SCREEN_W } from '../theme';

/**
 * Lays every screen out on the 390 x 844 Figma artboard and scales it to fit.
 * On the web preview it shows the app as a phone with a Replay control under it.
 */
export function Stage({ children, onReplay }: { children: ReactNode; onReplay?: () => void }) {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const controls = isWeb ? 52 : 0;
  const scale = isWeb
    ? Math.min((width - 24) / SCREEN_W, (height - 24 - controls) / SCREEN_H, 1.15)
    : width / SCREEN_W;

  return (
    <View style={[styles.root, isWeb && styles.webRoot]}>
      <View style={{ width: SCREEN_W * scale, height: SCREEN_H * scale }}>
        <View
          style={[
            styles.phone,
            isWeb && styles.webPhone,
            { transform: [{ translateX: (SCREEN_W * (scale - 1)) / 2 }, { translateY: (SCREEN_H * (scale - 1)) / 2 }, { scale }] },
          ]}
        >
          {children}
        </View>
      </View>
      {isWeb && onReplay ? (
        <Pressable onPress={onReplay} style={({ pressed }) => [styles.replay, pressed && { opacity: 0.6 }]}>
          <Text style={styles.replayText}>↺  Replay</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  webRoot: { backgroundColor: '#1C1612' },
  phone: { width: SCREEN_W, height: SCREEN_H, overflow: 'hidden', backgroundColor: '#fff' },
  webPhone: {
    borderRadius: 48,
    boxShadow: '0px 30px 60px rgba(0,0,0,0.45), 0px 0px 0px 10px #0B0907, 0px 0px 0px 11px #3A322C',
  },
  replay: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,244,234,0.1)',
  },
  replayText: { color: '#FFF4EA', fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.3 },
});
