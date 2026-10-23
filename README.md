# ShufflePop! 1.7.10 — Simple global leaderboard

See [1.7.10 notes](docs/UPDATE_1_7_10.md). The global solo leaderboard runs on Render with Neon storage; no PC tunnel is required.

# ShufflePop! 1.7.7 — New solo game and global wins leaderboard

See [1.7.7 notes](docs/UPDATE_1_7_7.md), including the pending backend activation.

# ShufflePop! 1.7.6 — Bold landscape cards and simpler settings

See [1.7.6 notes](docs/UPDATE_1_7_6.md).

# ShufflePop! 1.7.5 — larger cards and a hand that stays open

See [1.7.5 notes](docs/UPDATE_1_7_5.md). Portrait fits 3–4 cards; landscape has larger cards and a wider message.

# ShufflePop! 1.7.4 — wider portrait hand, stable End turn spacing

See [1.7.4 notes](docs/UPDATE_1_7_4.md). Portrait shows 4–5 cards; landscape cards are larger.

# ShufflePop! 1.7.3 — open hand replaces Your cards control

See [1.7.3 notes](docs/UPDATE_1_7_3.md). The message stays visible and the central piles stay fixed.

# ShufflePop! 1.7.2 — stable table when revealing your hand

See [1.7.2 notes](docs/UPDATE_1_7_2.md). Tap Your cards to replace the instruction with your hand. Draw and Discard stay in place.

# ShufflePop! 1.7.1 — three approved table themes

Based on 1.6.7, with its original card controls and layout. See [theme update notes](docs/UPDATE_1_7_1.md).

# ShufflePop1.6.7 — centered landscape YOUR CARDS

The hand control is centered at the bottom; the message remains above the hand. Portrait is unchanged. See [update notes](docs/UPDATE_1_6_7.md).

# ShufflePop1.6.6 — landscape message above your cards

Current landscape instructions appear above the hand. Portrait is unchanged. See [update notes](docs/UPDATE_1_6_6.md).

# ShufflePop1.6.5 — Android landscape window correction

Landscape gameplay now uses the full native window, a six-pixel table gutter, and larger1.6.1card proportions on normal landscape screens. Portrait presentation is unchanged. See [update notes](docs/UPDATE_1_6_5.md).

# ShufflePop1.6.4 — landscape table footer

Landscape places the current message and End turn/ONE controls in a bottom row inside the table, with the hand controls above. Portrait retains1.6.3 spacing. See [update notes](docs/UPDATE_1_6_4.md).

# ShufflePop 1.6.3 — 1.6.1 spacing refinement

Landscape table extends to the safe bottom edge. Portrait keeps small margins and larger central card piles, while preserving the original 1.6.1 opponent positions. See [update notes](docs/UPDATE_1_6_3.md).

# ShufflePop 1.6.1 — portrait and adaptive gameplay

See [responsive update notes](docs/UPDATE_1_6_1.md) for orientation behavior and device checks.

# ShufflePop Android

## Current development: 1.6.0 game-feel preview

Flat landscape table, four-side seats, folding private hand, table-deck drawing, and one current colored message. Tutorial and optional game effects remain. Invite-only room-code multiplayer connects to the existing HTTPS test server. Card flights, distinctive action feedback, ONE badges, expressive reactions, shorter waiting and winner spotlights enrich the round. See [update notes](docs/UPDATE_1_6.md) and [quality notes](docs/QUALITY.md).

The debug package is `com.dhavalrajput.shufflepop.landscape`, installed alongside earlier Preview apps. This is a development build, not a Play release. Rooms remain in memory; two-phone verification is required.

The following sections describe earlier offline releases.

## Version 1.2.0

Six emoji reactions below your hand, two-second reaction bubbles, a 2.2-second player cooldown, and occasional bot reactions. Reactions clear when leaving or pausing the game. The hand sits closer to the table. Online rooms remain planned.

## Version 1.1.0 test update

- Android Back returns to Home; no Home button in the game.
- Home buttons provide press feedback.
- Number cards can be played one at a time in a same-number run across colors. Tap End turn to finish; the last color remains active.
- Action and wild cards end the turn immediately. A drawn number may begin a same-number run.
- End turn and ONE controls appear only when relevant.
- Easy bots make relaxed, legal choices using their own hands; the deck is not biased.
- Existing saved games migrate, including support for saving during a run.

Colorful, offline-first card-game prototype published by **Dhaval Rajput**.

## Current prototype

- Original ShufflePop branding and card artwork
- Solo play against three bots
- Complete 108-card rule engine
- Wild color choice, skip, reverse, draw two, draw four, and ONE call
- Saved game and win count stored only on the device
- First-person angled Mat table
- No account, ads, analytics, network permission, or data collection

Online private rooms are deliberately reserved for Phase 2. In that flow, the host will choose the shared Wood, Mat, or Grass table.

## Configuration

- Application ID: `com.dhavalrajput.shufflepop`
- Target/compile SDK: 36
- Minimum SDK: 26
- Java: 17
- Publisher: Dhaval Rajput

## Test the game engine

```bash
node --test tests/*.test.js
```

## Build in Android Studio

1. Open this directory in Android Studio.
2. Install Android SDK 36 and accept the requested Gradle sync.
3. Run the `app` configuration on a phone or emulator.

The Gradle wrapper is included. With JDK 17 and Android SDK 36 configured, run `./gradlew assembleDebug` (or `gradlew.bat assembleDebug` on Windows). The installable test APK is produced in `app/build/outputs/apk/debug/app-debug.apk`.

## Install the test APK

Copy `ShufflePop_Test.apk` to an Android phone running Android 8.0 or later. Open it and allow the file manager or browser to install this app if Android prompts. Tap Install, then open ShufflePop. This debug-signed build is for testing; it is not a Play Console release bundle.

The project intentionally does not contain an upload keystore or passwords. Before a Play release, create a private upload key, add an ignored `keystore.properties`, and run `bundleRelease`. Enrol in Google Play App Signing and keep the upload key backed up securely.

## Release status

This source is a playable offline prototype, not the final online multiplayer release. The next development phase is anonymous guest identity, Host/Join room codes, authoritative game state, reconnection, lobby, rematch, and host-only table selection.
