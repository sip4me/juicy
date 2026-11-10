# Juicy

Snap what you eat, rate it in one tap, and watch your taste profile take shape.

This is the Expo (React Native) app. It currently has the first three onboarding screens from the Figma file:

1. **Splash**: the mouth logo pops in and "juicy" (Fraunces) rises under it.
2. **Welcome**: a glossy mouth bites, then springs open to reveal **Join Juicy** and **I already have an account**. Tapping Join chomps the mouth shut and moves on.
3. **Snack goblin**: the first quiz question; tap a card to pick your snacker type.

## Run it on your phone

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (Android) or the Camera app (iOS).

## How the mouth animation works

`src/screens/Welcome.tsx` drives the whole opening from **one spring** (`p`, 0 = closed, 1 = open), using Reanimated on the UI thread:

- **Anticipation**: `p` dips to `-0.045` for 150 ms (a tiny bite) before springing open.
- **Jaws**: the upper and lower jaws translate ±178 px with `p`, so they can never drift apart.
- **Teeth ripple**: every tooth has its own slightly bouncier spring, delayed from the centre outwards. The difference from `p` makes each tooth trail and settle, so the rows ripple.
- **Lips** stretch a little mid-open and relax.
- **Content** (title, tagline, buttons) fades and rises in one after another once the jaws are far enough apart.
- **Haptics**: a medium impact as it opens and a heavy one when it chomps shut (on phones).

Tune it with the constants at the top of the file: `CLENCH`, `OPEN_SPRING`, `TOOTH_SPRING`, `TRAVEL`.

## Layout

Screens are laid out on the 390 × 844 Figma artboard and scaled to fit by `src/components/Stage.tsx`.

```
App.tsx                     flow: splash → welcome → snack goblin
src/screens/                Splash, Welcome, SnackGoblin
src/components/             Lips (SVG), Tooth, Stage, StatusBarMock
src/theme.ts                colours and fonts (Fraunces + Outfit)
assets/                     logo and food icons exported from Figma
scripts/build-preview.mjs   single-file web preview
```

## Web preview

```bash
npm run preview
```

This writes `dist/juicy-preview.html`, a self-contained page of the same code that runs in a browser.

## Backend (Supabase)

Project `betvlurcdcqrplzlwltl`. Juicy's tables live in the **`juicy`** schema (the project also holds an older app in `public`).

```
supabase/migrations/   schema, row-level security, create_post, feeds, ranking cron
supabase/functions/    recognize-meal (Gemini vision → dish catalog → Juicy score)
src/lib/supabase.ts    client (publishable key from .env)
src/lib/newPost.ts     photo → filter + shrink → upload → recognize → create_post; feed loaders
src/lib/filters.ts     color-matrix filters shared by preview and export
src/screens/Camera.tsx, EditPhoto.tsx
```

One-time setup in the Supabase dashboard:
1. **Project Settings → Data API → Exposed schemas**: add `juicy`.
2. **Edge Functions → Secrets**: add `GEMINI_API_KEY` (from Google AI Studio).

Camera and Skia need a development build (`npx expo run:ios` or `eas build --profile development`); set `EXPO_PUBLIC_START=camera` to open straight to the camera.
