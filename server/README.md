# ShufflePop room API

Requires Node.js 20 or later. No npm dependencies.

Local run: `node server/http.js`.
Tests from project root: `node --test tests/*.test.js`.

Configure HOST=0.0.0.0 and PORT on a server behind HTTPS. Never expose guest tokens in logs. The allowed browser origin is https://appassets.androidplatform.net; the API is not intended to serve UI or arbitrary browser origins. Use only a single process until room persistence and shared coordination exist. In-memory rooms disappear after server restart or thirty minutes of inactivity. Edge limits must be configured for shared reverse-proxy deployments.

The Android build receives the HTTPS API origin through `-PmultiplayerApiBase=https://YOUR-ACTUAL-API-HOST`. Do not include a trailing slash. Never put secrets in this public URL setting.

See MULTIPLAYER_PROGRESS.md for current limitations before external testing.
