import { Platform, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme';

/** The 9:41 status bar from the Figma frames. Only drawn in the web preview; phones show their real one. */
export function StatusBarMock({ tint = '#111111' }: { tint?: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={styles.bar} pointerEvents="none">
      <Text style={[styles.time, { color: tint }]}>9:41</Text>
      <View style={styles.right}>
        <View style={[styles.signal, { backgroundColor: tint }]} />
        <View style={[styles.battery, { borderColor: tint }]}>
          <View style={[styles.batteryFill, { backgroundColor: tint }]} />
        </View>
      </View>
    </View>
  );
}

export function HomeIndicator({ tint = '#111111' }: { tint?: string }) {
  return <View pointerEvents="none" style={[styles.home, { backgroundColor: tint }]} />;
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 47, zIndex: 50 },
  time: { position: 'absolute', left: 28, top: 14, fontFamily: fonts.semibold, fontSize: 15 },
  right: { position: 'absolute', right: 28, top: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  signal: { width: 17, height: 11, borderRadius: 2 },
  battery: { width: 25, height: 12, borderRadius: 3.5, borderWidth: 1.4, padding: 1.5 },
  batteryFill: { flex: 1, borderRadius: 1.5 },
  home: { position: 'absolute', bottom: 8, left: 128, width: 134, height: 5, borderRadius: 3, zIndex: 50 },
});
