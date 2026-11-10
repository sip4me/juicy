import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { fonts } from '../theme';

const INK = '#2B2420';
const ORANGE = '#F7A13A';

/** "New post · 0 Camera" from Figma: live viewfinder, close, flash, shutter, flip. */
export function Camera({ onClose, onCaptured }: { onClose: () => void; onCaptured: (uri: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [busy, setBusy] = useState(false);

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.ask]}>
        <Text style={styles.askTitle}>Snap what you eat</Text>
        <Text style={styles.askBody}>Juicy needs the camera to see your food. Photos stay private until you post.</Text>
        <Pressable style={styles.askButton} onPress={requestPermission}>
          <Text style={styles.askButtonText}>{permission.canAskAgain ? 'Allow camera' : 'Open Settings'}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.askLater}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  async function shoot() {
    if (busy || !cam.current) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) onCaptured(photo.uri);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />

      <View style={styles.top}>
        <RoundButton onPress={onClose} label="Close">
          <Icon d="M6 6 L18 18 M18 6 L6 18" />
        </RoundButton>
        <RoundButton onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))} label="Flash" active={flash === 'on'}>
          <Icon d="M13 2 L5 13 H11 L10 22 L18 10 H12 Z" />
        </RoundButton>
      </View>

      {/* focus corners */}
      <View pointerEvents="none" style={styles.focus}>
        {[0, 90, 180, 270].map((r) => (
          <View key={r} style={[styles.corner, cornerPos[r]]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${r}deg` }] }}>
              <Path d="M3 12 V3 H12" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
            </Svg>
          </View>
        ))}
      </View>

      <View style={styles.bottom}>
        <View style={styles.side} />
        <Pressable onPress={shoot} accessibilityLabel="Take photo" style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}>
          <View style={[styles.shutterInner, busy && { backgroundColor: ORANGE }]} />
        </Pressable>
        <RoundButton onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} label="Flip camera" size={48}>
          <Icon d="M4 12 A8 8 0 0 1 18 7 M18 3 V7 H14 M20 12 A8 8 0 0 1 6 17 M6 21 V17 H10" />
        </RoundButton>
      </View>
    </View>
  );
}

function RoundButton({ children, onPress, label, active, size = 40 }: { children: React.ReactNode; onPress: () => void; label: string; active?: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2 }, active && { backgroundColor: ORANGE }]}
    >
      {children}
    </Pressable>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d={d} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const cornerPos: Record<number, object> = {
  0: { left: 0, top: 0 },
  90: { right: 0, top: 0 },
  180: { right: 0, bottom: 0 },
  270: { left: 0, bottom: 0 },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B2018' },
  top: { position: 'absolute', top: 54, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  focus: { position: 'absolute', left: 60, right: 60, top: 230, height: 354 },
  corner: { position: 'absolute' },
  bottom: { position: 'absolute', bottom: 60, left: 48, right: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 48 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  ask: { backgroundColor: '#EFEAE3', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  askTitle: { fontFamily: fonts.display, fontSize: 28, color: INK },
  askBody: { fontFamily: fonts.regular, fontSize: 15, color: '#8C8178', textAlign: 'center', lineHeight: 21 },
  askButton: { marginTop: 10, backgroundColor: INK, borderRadius: 28, paddingVertical: 16, paddingHorizontal: 40 },
  askButtonText: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff' },
  askLater: { fontFamily: fonts.medium, fontSize: 14, color: '#8C8178', marginTop: 6 },
});
