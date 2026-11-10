import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, ColorMatrix, Image, useImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { FILTERS, type FilterId } from '../lib/filters';
import { exportPhoto, NotFoodError, uploadAndRecognize } from '../lib/newPost';
import type { Meal } from '../lib/supabase';
import { fonts } from '../theme';

const PAPER = '#EFEAE3', INK = '#2B2420', GREY = '#8C8178', ORANGE = '#F7A13A', SURF = '#FFFDFA';

/**
 * "New post · 1 Edit": live filter preview (GPU, via Skia), then Next →
 * the filtered photo is shrunk + uploaded, and the backend names the dish.
 */
export function EditPhoto({ uri, onBack, onRecognized }: {
  uri: string;
  onBack: () => void;
  onRecognized: (meal: Meal, filter: FilterId) => void;
}) {
  const image = useImage(uri);
  const [filter, setFilter] = useState<FilterId>('juicy');
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const matrix = FILTERS.find((f) => f.id === filter)!.matrix;

  async function next() {
    setState('working');
    try {
      const jpeg = await exportPhoto(uri, filter);
      const meal = await uploadAndRecognize(jpeg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRecognized(meal, filter);
    } catch (e) {
      setState('error');
      setMessage(e instanceof NotFoodError ? e.message : 'Something went wrong. Try again?');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={8} accessibilityLabel="Back">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Pressable onPress={next} disabled={state === 'working'} style={styles.next}>
          {state === 'working' ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextText}>Next</Text>}
        </Pressable>
      </View>

      <View style={styles.photo}>
        {image && (
          <Canvas style={StyleSheet.absoluteFill}>
            <Image image={image} x={0} y={0} width={358} height={420} fit="cover">
              <ColorMatrix matrix={matrix} />
            </Image>
          </Canvas>
        )}
        {state === 'working' && (
          <View style={styles.scan}>
            <Text style={styles.scanText}>Tasting…</Text>
          </View>
        )}
      </View>

      {state === 'error' ? <Text style={styles.error}>{message}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(f.id);
            }}
            style={styles.thumbWrap}
          >
            <View style={[styles.thumb, filter === f.id && styles.thumbOn]}>
              {image && (
                <Canvas style={StyleSheet.absoluteFill}>
                  <Image image={image} x={0} y={0} width={68} height={68} fit="cover">
                    <ColorMatrix matrix={f.matrix} />
                  </Image>
                </Canvas>
              )}
            </View>
            <Text style={[styles.thumbLabel, filter === f.id && { color: INK }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER, paddingTop: 54 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: SURF, borderWidth: 1, borderColor: '#CFC6BA', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 26, color: INK, marginTop: -3 },
  next: { backgroundColor: INK, borderRadius: 22, height: 44, minWidth: 84, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontFamily: fonts.semibold, color: '#fff', fontSize: 15 },
  photo: { marginTop: 18, marginHorizontal: 16, width: 358, height: 420, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F7F3EE' },
  scan: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(43,36,32,0.35)', alignItems: 'center', justifyContent: 'center' },
  scanText: { fontFamily: fonts.display, fontSize: 26, color: '#fff' },
  error: { fontFamily: fonts.medium, color: '#C8641A', textAlign: 'center', marginTop: 12 },
  strip: { paddingHorizontal: 16, paddingTop: 22, gap: 12 },
  thumbWrap: { alignItems: 'center', gap: 6 },
  thumb: { width: 68, height: 68, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: ORANGE },
  thumbLabel: { fontFamily: fonts.medium, fontSize: 12, color: GREY },
});
