# ShufflePop! 1.7.11 — AdMob app open ads

## AdMob configuration

- Android application ID: `com.dhavalrajput.shufflepop`
- AdMob app ID: `ca-app-pub-5496630814582780~4324904067`
- App open ad unit ID (release): `ca-app-pub-5496630814582780/1536012634`
- App open test ad unit ID (debug): `ca-app-pub-3940256099942544/9257395921`
- Google Mobile Ads SDK: `com.google.android.gms:play-services-ads:25.5.0`

## Implementation

- The SDK is initialized once from `MainActivity` on a background thread.
- The app open ad is preloaded after SDK initialization and reloaded after dismissal or a show failure.
- Debug builds use Google's dedicated app open test unit. Release builds use the supplied production ad unit.
- A loaded ad is discarded after four hours.
- The first app launch is excluded.
- A JavaScript-to-Android placement bridge enables showing only while the home screen is active. The bridge disables the placement during gameplay, so returning to an active round does not interrupt play.
- App foreground events are handled by the activity lifecycle. An ad already being displayed does not trigger a second app-open presentation.

## Privacy and release checks

The in-app privacy notice now discloses AdMob app open ads and links to Google's privacy policy. Before publishing, ensure the Play Console Data safety form and the public privacy policy accurately describe the Google Mobile Ads SDK and its data practices. Review AdMob consent requirements for the app's target regions and configure a Google-certified consent management platform if required.

## Verification checklist

1. Build and install the debug variant. Confirm requests use Google's test app open ad unit.
2. Launch for the first time: no app open ad should appear.
3. Return to the app while on the home screen: an available test ad may appear.
4. Start a solo game or join an online room, background and resume: no app open ad should interrupt gameplay.
5. Dismiss an ad and confirm a replacement is requested.
6. Confirm the release variant resolves to the production ad unit.
7. Verify Play Console Data safety, privacy policy, consent messaging, and upload signing before release.

The repository does not contain the private upload keystore. A signed release AAB must be built with the owner's local `keystore.properties` and upload key.
