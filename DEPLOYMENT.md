# Step 5: deploy a test backend, then build Android

Deployment has not happened yet. The Render connection is not installed, GitHub access to dhavalrajput2004/shufflepop-android returns 404, and no public API origin is configured. Do not treat the example below as a live URL.

## Render test deployment
1. Install/connect Render in ChatGPT, or use the Render dashboard yourself. Give Render access to the GitHub repository containing this extracted project.
2. Upload the extracted source to the root of your private repository, preserving the folders. Do not upload signing backups or keystore.properties.
3. Create a Web Service from that repository, using the root render.yaml Blueprint, or the manual settings below:

   Runtime: Node
   Node version: 22 (provided by .node-version)
   Build command: npm test
   Start command: npm start
   Environment: HOST=0.0.0.0
   Health check: /health
   Plan: Free, for temporary testing
   Automatic deploys: Off

Render supplies PORT and the HTTPS URL. One instance/process only. Free services sleep after 15 minutes without inbound traffic and may restart; current rooms are in memory and disappear on restart. Free hosting is unsuitable for reliable public multiplayer without further persistence/availability work. Open /health and wait until the service is awake before beginning phone tests.

## Verify the live URL
Run from the project root, substituting the actual HTTPS origin without trailing slash:

    npm run verify:deployment -- https://YOUR-ACTUAL-API-HOST

The script checks health, Android CORS, creation/joining, readiness, private hand views and a validated move. It removes only its temporary rooms afterwards. Guest tokens are never printed. Local tests verified this smoke script against the real HTTP service on loopback; it has not been run against a public deployment yet.

## Build a phone test APK
Install JDK 17, Android SDK 36 (including build tools 36.0.0), and Node.js 22. Set the Android SDK location through Android Studio, ANDROID_HOME or ignored local.properties. From the project root:

    node scripts/build-online-apk.js https://YOUR-ACTUAL-API-HOST

On Linux/macOS, first make gradlew executable: chmod +x gradlew. The build helper runs the deployment smoke check and only then calls assembleDebug with the actual server origin. Gradle wrapper may need to download dependencies on first use. APK output: app/build/outputs/apk/debug/app-debug.apk.

Debug APKs use the building machine's debug certificate. If it differs from a previously installed debug APK or Play-signed app, Android will reject an in-place update. Use a spare test device/profile, or uninstall the old test build if its local saved data is no longer needed. This helper does not build a Play-signed release.

For a future release AAB, restore the existing private upload key and ignored keystore.properties, then run bundleRelease with the same multiplayerApiBase property. Do not create a replacement upload key merely because this package excludes signing secrets.

## Two-phone checks
- Host on phone A; join the same code on phone B, preferably with separate networks.
- Ready both players; verify both see the same turn/top card but different private hands.
- Finish a round, including same-number plays, Wild choice and ONE.
- Exchange emoji reactions; verify cooldown and expiry.
- Background one phone and return within 90 seconds; verify the original hand and seat.
- Let the reconnect grace expire and verify a fresh ready lobby and host transfer.
- Rematch and check old delayed moves cannot change the fresh round.

## Before a Play update
Public hosting, device/build validation, current privacy policy and Data safety declarations remain necessary. Actual hosting costs are controlled in the provider account. No paid resource has been created by this step.
