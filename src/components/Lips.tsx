import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Glossy orange lips matching the logo artwork. Paths are in 390 x 844 artboard
// coordinates (the same ones as the Figma Welcome frames); each lip's SVG only
// covers its own band of the screen via the viewBox.

const LIP_STOPS = [
  { o: 0, c: '#FFA46A' },
  { o: 0.32, c: '#FF6E30' },
  { o: 0.75, c: '#D9481A' },
  { o: 1, c: '#A3320B' },
];

function Gloss({ id }: { id: string }) {
  // Specular streak that fades out at both ends.
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
      <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.95" />
      <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0.85" />
      <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
    </LinearGradient>
  );
}

export function UpperLip() {
  return (
    <Svg style={[styles.svg, { top: 110, height: 220 }]} viewBox="0 110 390 220" pointerEvents="none">
      <Defs>
        <LinearGradient id="ulBody" x1="0" y1="0" x2="0" y2="1">
          {LIP_STOPS.map((s) => (
            <Stop key={s.o} offset={s.o} stopColor={s.c} />
          ))}
        </LinearGradient>
        <LinearGradient id="ulRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="ulShadow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A0A02" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#1A0A02" stopOpacity="0" />
        </LinearGradient>
        <Gloss id="ulGloss" />
      </Defs>
      {/* shadow the lip casts onto the teeth */}
      <Path
        d="M -20 280 C 60 242 120 302 195 272 C 270 238 330 300 410 260 L 410 288 C 330 328 270 266 195 300 C 120 330 60 270 -20 308 Z"
        fill="url(#ulShadow)"
      />
      {/* lip body */}
      <Path
        d="M -20 168 C 60 126 120 192 195 160 C 270 128 330 192 410 148 L 410 262 C 330 302 270 240 195 274 C 120 304 60 244 -20 282 Z"
        fill="url(#ulBody)"
      />
      {/* rolled underside (darker fold where the lip tucks in) */}
      <Path
        d="M -20 264 C 60 228 120 286 195 256 C 270 224 330 284 410 244 L 410 262 C 330 302 270 240 195 274 C 120 304 60 244 -20 282 Z"
        fill="#7A2205"
        opacity={0.45}
      />
      {/* top rim light */}
      <Path
        d="M -20 168 C 60 126 120 192 195 160 C 270 128 330 192 410 148 L 410 172 C 330 214 270 150 195 184 C 120 214 60 152 -20 192 Z"
        fill="url(#ulRim)"
      />
      {/* wet inner edge highlight */}
      <Path d="M 20 268 C 80 240 130 284 190 262" stroke="#FFC9A6" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M 210 258 C 270 232 320 280 372 252" stroke="#FFC9A6" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {/* specular streaks */}
      <Path d="M 12 182 C 62 156 112 192 172 176" stroke="url(#ulGloss)" strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M 222 170 C 282 148 332 182 382 164" stroke="url(#ulGloss)" strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M 40 210 C 80 196 112 214 148 206" stroke="url(#ulGloss)" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
      <Path d="M 250 200 C 290 186 322 206 356 196" stroke="url(#ulGloss)" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
    </Svg>
  );
}

export function LowerLip() {
  return (
    <Svg style={[styles.svg, { top: 540, height: 220 }]} viewBox="0 540 390 220" pointerEvents="none">
      <Defs>
        <LinearGradient id="llBody" x1="0" y1="0" x2="0" y2="1">
          {LIP_STOPS.map((s) => (
            <Stop key={s.o} offset={s.o} stopColor={s.c} />
          ))}
        </LinearGradient>
        <LinearGradient id="llShadow" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#1A0A02" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#1A0A02" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="llWet" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE0CC" stopOpacity="0.75" />
          <Stop offset="1" stopColor="#FFE0CC" stopOpacity="0" />
        </LinearGradient>
        <Gloss id="llGloss" />
      </Defs>
      {/* shadow onto the lower teeth */}
      <Path
        d="M -20 574 C 60 616 120 552 195 584 C 270 616 330 560 410 596 L 410 578 C 330 542 270 598 195 566 C 120 534 60 598 -20 556 Z"
        fill="url(#llShadow)"
      />
      <Path
        d="M -20 574 C 60 616 120 552 195 584 C 270 616 330 560 410 596 L 410 702 C 330 742 270 680 195 712 C 120 742 60 688 -20 724 Z"
        fill="url(#llBody)"
      />
      {/* wet top of the lower lip */}
      <Path
        d="M -20 574 C 60 616 120 552 195 584 C 270 616 330 560 410 596 L 410 616 C 330 580 270 636 195 604 C 120 572 60 636 -20 594 Z"
        fill="url(#llWet)"
      />
      {/* underside shade */}
      <Path
        d="M -20 700 C 60 664 120 718 195 690 C 270 660 330 720 410 680 L 410 702 C 330 742 270 680 195 712 C 120 742 60 688 -20 724 Z"
        fill="#6E1C04"
        opacity={0.4}
      />
      <Path d="M 18 612 C 68 628 118 596 168 612" stroke="url(#llGloss)" strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M 218 622 C 268 640 318 606 374 622" stroke="url(#llGloss)" strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M 70 680 C 140 694 260 694 330 680" stroke="url(#llGloss)" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.45} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: 0, width: 390 },
});
