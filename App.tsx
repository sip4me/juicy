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
import { Camera } from './src/screens/Camera';
import { EditPhoto } from './src/screens/EditPhoto';
import { colors } from './src/theme';

type Screen = 'splash' | 'welcome' | 'snack' | 'camera' | 'edit';

// EXPO_PUBLIC_START=camera opens straight to the new-post camera while it's being built.
const START: Screen = process.env.EXPO_PUBLIC_START === 'camera' ? 'camera' : 'splash';

function Flow() {
  const [screen, setScreen] = useState<Screen>(START);
  const [cameBack, setCameBack] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

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
      {screen === 'camera' && (
        <Animated.View key="camera" entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={styles.layer}>
          <Camera
            onClose={() => setScreen('welcome')}
            onCaptured={(uri) => {
              setPhoto(uri);
              setScreen('edit');
            }}
          />
        </Animated.View>
      )}
      {screen === 'edit' && photo && (
        <Animated.View key="edit" entering={SlideInRight.duration(320)} exiting={SlideOutRight.duration(260)} style={styles.layer}>
          <EditPhoto
            uri={photo}
            onBack={() => setScreen('camera')}
            onRecognized={(meal) => {
              // Next: Details & share-to screen, then publish({ mealId: meal.id, audiences, note, place })
              console.log('recognized', meal.dish_name, meal.juicy_score);
              setScreen('camera');
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
