# ShufflePop Android

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
