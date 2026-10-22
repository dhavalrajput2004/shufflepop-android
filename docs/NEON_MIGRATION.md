# Solo leaderboard migration to Neon

Status: prepared and tested on an isolated branch; live cutover awaits the PC snapshot. Do not configure DATABASE_URL or stop relying on the PC until the snapshot is imported and verified.

Project: ShufflePop leaderboard, jolly-wildflower-40382572, Singapore, organization Rajput (free plan). Production branch: br-wild-dawn-a106x0nh. Test branch: br-rough-frog-a1mcw647. Existing JSON_rikshaw project is unchanged. Connection strings are private runtime configuration and must never be committed.

## Before cutover

1. Stop the PC START-WINDOWS server so its snapshot stops changing. Keep its HTTPS tunnel open during the short migration window.
2. Obtain pc-leaderboard/data/solo-wins.json privately. The file contains profile credential hashes; preserve it as a backup and do not publish it.
3. Apply server/migrations/001-solo-leaderboard.sql to the production database using a direct connection.
4. Set DATABASE_URL_UNPOOLED privately and run node server/import-leaderboard.js /private/path/solo-wins.json. The import is transactional and refuses a nonempty destination. It preserves IDs, names, credential hashes, wins, timestamps and active ranked-round seeds.
5. Check profile count, sum of wins, active-round count and public ranking order against the snapshot.

## Deployment

Merge this branch, then configure the existing Render service's build command as npm ci && npm test. Keep its existing start command and free compute plan. Set DATABASE_URL privately to the pooled production URL. Never expose it to the Android app. DATABASE_URL takes precedence over the old PC relay environment setting.

Deploy and wait for live status. Verify /health reports soloLeaderboard:true, the global ranking matches imported data, and an existing player's profile still works. Only after successful verification may the PC server and tunnel be closed. No Android update is needed.

If validation fails, remove DATABASE_URL and redeploy the previous relay configuration. Keep the PC data backup until post-cutover checks are complete. Do not delete or overwrite either store as part of rollback.

The database adapter uses a row lock and transaction for verified win completion, an atomic UPDATE for round starts, and database uniqueness constraints for nicknames and profile credentials. PostgreSQL query parameters carry all user data.

## Validation

Postgres-compatible embedded tests cover registration, authentication, invalid-result rollback, concurrent duplicate finish, HTTP integration and import preservation. Existing API/rule tests also pass. Test-branch schema creation was verified on live Neon. Direct TCP access to Neon is blocked from this execution workspace; verify the production connection from Render during cutover before reporting it live.
