# Wavehaus 1.0 operations

## Install

The GitHub Pages site is a static marketing/docs site plus a separate browser demo. PHP and Worker archives contain production assets, the same migrations/API contract, and optional local MCP tools. They contain no live databases, uploaded files or secrets.

On PHP use the included README.txt. Keep the private data directory outside the web root when possible. The protected random fallback directory is used only when outside storage is restricted. Preserve that exact directory and config.php during upgrades. Setup saves the first owner and ten recovery codes; it cannot be repeated after an account exists. HTTPS and .htaccess are required.

On Cloudflare follow README.md, install dependencies in server-worker, create/bind D1 and R2, set APP_SECRET, then run npm run deploy. Migration application happens before code publication. The runtime refuses a schema mismatch. Node/Wrangler are deployment tools; PHP needs neither.

## Update and restore

Back up the complete server data and stop new writes during a manual copy/restore. PHP automatically makes a consistent pre-migration SQLite snapshot under a file lock and retains five snapshots. That snapshot covers the DB only. For a manual SQLite copy use a consistent SQLite backup or copy the DB and its WAL/SHM together while writes are stopped. A hosting provider's complete backup is another option. Keep media, art and config.php with the database backup.

For PHP extract the new archive with overwrite into the application directory. Do not replace or empty the data directory. The first request runs pending versioned migrations. For Cloudflare retain a D1 export/recovery point and a separate R2 backup, keep bindings/secrets, then deploy forward migrations and code.

For rollback keep the current files/DB first, then restore the database snapshot matching the older code and its media/art/config. Older code refuses a newer schema. D1 restore uses the matching export or recovery point plus Worker code and R2 objects. Database restoration is an operational task via cPanel/SQLite tooling or Cloudflare; the app links to this procedure rather than accepting an uploaded database through the browser.

Settings → Updates displays client/server/schema versions. Check app update asks the service worker for new assets; Apply pauses playback and reloads the saved queue. Server code is upgraded using its archive or Wrangler, not by the PWA. Existing tabs may need to reload after an upgrade.

## Recovery and access

Recovery codes work once and replace the password/revoke sessions. When all codes are lost, use RESET_OWNER in the private PHP config or Worker secret, open /setup/reset, then remove the reset flag. Each reset value works once. Never put passwords or tokens in issue reports.

Closed is the first-run registration mode. Owners can enable invites, requests or open signup; listener accounts cannot upload. Public music means shared with signed-in server members. The owner/admin may take down another member's public content but cannot publish or read their private files.

## Retention and browser data

Deleted metadata and immutable media/art remain available for 30-day Undo; deleting a row does not immediately reclaim its media quota. Expired journal snapshots are pruned while activity summaries remain. Automatic physical media garbage collection is outside the 1.0 release; retain files referenced by backups and live rows when performing manual cleanup.

Browser downloads are separate full copies. Clearing site data removes the browser demo's originals as well as its downloads. Offline authorization uses the last signed-in account and session expiry; reconnection checks current permissions. Offline sign-out clears local copies immediately and retries the server logout when a connection returns.

## Release boundary

Milestones M0–M10 are implemented and published through 1.0. No additional tests, browser QA, Lighthouse or physical-device checks were run after the owner's explicit instruction to stop testing. Only package/Pages builds and Worker compilation were run for publication. Historical results are preserved in PROGRESS.md, and must not be read as measurements of every later change. iPhone background play and codec behavior remain best effort. P2 crossfade/ReplayGain/external share links are not in this release.
