import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { Stage } from './src/components/Stage';
import { Splash } from './src/screens/Splash';
import { Welcome } from './src/screens/Welcome';
import { SnackGoblin } from './src/screens/SnackGoblin';
import { colors } from './src/theme';

type Screen = 'splash' | 'welcome' | 'snack';

function Flow() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [cameBack, setCameBack] = useState(false);

  return (
    <View style={styles.fill}>
      {screen === 'splash' && (
        <Animated.View key="splash" exiting={FadeOut.duration(380)} style={styles.layer}>
          <Splash onDone={() => setScreen('welcome')} />
        </Animated.View>
      )}
      {screen === 'welcome' && (
        <Animated.View key="welcome" entering={FadeIn.duration(380)} exiting={FadeOut.duration(220)} style={styles.layer}>
          <Welcome quickOpen={cameBack} onJoin={() => setScreen('snack')} />
        </Animated.View>
      )}
      {screen === 'snack' && (
        <Animated.View key="snack" entering={SlideInRight.duration(420)} exiting={SlideOutRight.duration(320)} style={styles.layer}>
          <SnackGoblin
            onBack={() => {
              setCameBack(true);
              setScreen('welcome');
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  const [run, setRun] = useState(0);
  const [loaded] = useFonts({ Fraunces_600SemiBold, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });

  return (
    <Stage onReplay={() => setRun((r) => r + 1)}>
      <StatusBar style="light" />
      {loaded ? <Flow key={run} /> : <View style={[styles.fill, { backgroundColor: colors.amber }]} />}
    </Stage>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
