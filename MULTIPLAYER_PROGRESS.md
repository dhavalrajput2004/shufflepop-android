# ShufflePop multiplayer — steps 1–5

Base: approved 1.2.1 source. Development Android version 1.3.0-dev, code 6. This is source for development, not a Play release. The existing closed-test release is unchanged.

## Implemented
- Shared rule engine: solo and 2–4 human players, same-number turns, action cards, Wild choices, ONE calls, two-player Reverse as Skip.
- Server-authoritative moves, private hand views, revisions and secure shuffle.
- Six-character private rooms, guest bearer tokens, nickname/avatar, capacity, ready gates, host-only table surfaces.
- Dependency-free HTTP API with explicit Android asset-origin CORS, authorization, request limits, IP/session rate limits and no-store responses.
- Android Host/Join/lobby and server-driven gameplay client with polling; solo remains offline.
- Guest token saved in device-private WebView local storage, scoped to the API origin. Cloud backup remains disabled. The token is a secret and is not encrypted separately within the app sandbox. It is not sent in URL parameters or included in public views. Leaving, forgetting, or session expiry clears it. Reloading the client can restore a seat while the server retains the room.
- Presence via authenticated requests. Missing heartbeats pause moves after 10 seconds; explicit Back/background disconnect pauses immediately. Seat held for 90 seconds after detected disconnect. Returning with the same token restores the same hand and seat. If grace expires, round is abandoned without awarding a win, lost sessions are removed, surviving players return to a ready lobby, and host transfers if needed. Whole rooms expire after 30 minutes without authenticated activity.
- Host can request a rematch after a round ends. All players must ready again before dealing. Room code and sessions stay the same; revisions never reuse an earlier round value, preventing delayed commands from applying to a new deal.
- Six shared emoji reactions, 2.2-second per-player cooldown, 3-second server retention. No free-text chat. Room options allow explicit leaving; leaving mid-round abandons the round for everyone.
- Network retry backoff, stale-request suppression, disabled gameplay controls during disconnection, and invalid-session recovery.

## Run and build
Node.js 20 or later. From project root:

    node --test tests/*.test.js
    node server/http.js

Local API binds 127.0.0.1:8080. Production hosting must set HOST=0.0.0.0 and PORT as needed, run one server process, and provide HTTPS. Host must enforce edge rate limits behind a proxy; server does not trust arbitrary X-Forwarded-For. Health route: GET /health.

POST /v1/rooms/create and /join establish a guest session. Remaining routes require Authorization: Bearer <guest token>: GET /view; POST /ready, /settings, /start, /move, /disconnect, /rematch, /react, /leave. Reactions send {emoji}; readiness sends {ready}; moves send {type, revision, cardId?, color?}.

Build Android with the real deployed HTTPS API origin (no path/trailing slash):

    ./gradlew assembleDebug -PmultiplayerApiBase=https://YOUR-ACTUAL-API-HOST

No address is configured by default, so Host/Join remain disabled until hosting is configured. Android adds INTERNET, keeps cleartext off, and restricts WebView network access and CSP to the configured origin's room endpoints.

## Validation and limitations
All 45 tests pass, including after final room-menu wiring. JavaScript syntax checks pass. Tests cover solo regressions, complete two-client HTTP rounds/rematches, private views, auth/rate/request limits, disconnect grace, timeout/host transfer, shared reaction expiry, persisted client tokens and invalid-token recovery. DOM-stub tests check client wiring, not visual appearance.

Server rooms and matches are still in memory. Server restart loses all rooms even though clients retain guest tokens; clients clear the resulting invalid session. Multi-process deployment, durable server persistence, push transport and production monitoring are not implemented.

No new APK/AAB, emulator, browser layout or physical two-phone test has been performed for these development steps. Android SDK/local Gradle tools from the original build session are not present. Do not upload to Play yet.

## Next
Choose and deploy an HTTPS backend, configure the API origin, restore signing key/build tools and generate a test APK. Run full games on two phones, including background/relaunch, disconnects, rematches and reactions. Update the public privacy policy and Play data declarations for the network data and hosting retention before submitting a multiplayer update. Signing secrets are excluded from this source ZIP.

## Step 5 — deployment package

Added Render Blueprint, Node package/run configuration, a minimal non-root Docker image recipe, live API verification script, and preflight Android APK build helper. See DEPLOYMENT.md. All 45 tests pass on the available Node 24.19.0 runtime; the Render configuration selects Node 22 and runs the full tests before deployment. No Docker build was possible because Docker is unavailable. Render is not yet connected; repository access still returns 404. No public deployment, APK or paid service has been created.
