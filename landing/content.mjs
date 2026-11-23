export const docs=[
 ['','Overview','GET STARTED',[
 ['Your music, at home','Wavehaus is a music streaming PWA for your own audio files. Upload from a phone or computer, organise the library in your browser, and listen anywhere. The demo stores everything in your current browser; production keeps files on your own server.'],
 ['Choose your home','Use PHP 8.1+ and SQLite on shared hosting, or Cloudflare Workers with R2 and D1. Both production packages are available in GitHub Releases. The browser demo needs no server.'],
 ['Install and listen','Open Wavehaus in Brave on Android, use Install app or Add to Home screen, then follow the Background play guide. No app store is needed.']
 ]],
 ['shared-hosting','Install on shared hosting','GET STARTED',[
 ['Before you start','You need a domain or subdomain with HTTPS, PHP 8.1 or newer, and the pdo_sqlite, fileinfo, mbstring and openssl extensions. Apache or LiteSpeed must allow .htaccess routing. A Namecheap-class shared host is enough.'],
 ['1. Download the release','Download wavehaus-shared-hosting-vX.Y.Z.zip from GitHub Releases. The shared-hosting archive contains the built PWA, PHP code and migrations. Keep a backup before replacing an existing installation.'],
 ['2. Upload and extract','In cPanel, create music.yourdomain.com. Open File Manager, go to its document root, upload the release zip and choose Extract. No terminal, Composer or Node is needed on the host.'],
 ['3. Keep your data outside the web root','Create a wavehaus-data folder in your hosting home, beside public_html. Your database, media, artwork and backups live here. Release updates replace code only. If your host cannot do this, setup uses a protected data directory and tells you its exact location.'],
 ['4. Open setup','Visit https://music.yourdomain.com/setup. The requirements check lists any missing extension or permission and its fix. Create your owner account, choose a server name, and save the ten recovery codes. Email is optional.'],
 ['5. Add music and install','Open Upload music, choose files or a folder, then check the import review. Open your server in Brave on your phone, install it from the menu and run the Background play test.'],
 ['Updating safely','Extract the next release over the app files. Keep wavehaus-data in place. The first request makes a database backup and applies pending migrations under a lock. See Updating safely for the full procedure.']
 ]],
 ['cloudflare','Install on Cloudflare','GET STARTED',[
 ['Before you start','Use a Cloudflare account and Node locally for Wrangler. Workers Paid is recommended for password hashing. R2 storage may have usage charges; check Cloudflare’s current pricing. No Node process runs on the server.'],
 ['Create the database and bucket','Download wavehaus-worker-v1.0.0.zip from GitHub Releases, extract it, run npm ci in server-worker, and run npx wrangler login, npx wrangler d1 create wavehaus and npx wrangler r2 bucket create wavehaus-media. Paste your database ID into server-worker/wrangler.toml. Run the following commands from that directory.'],
 ['Add a secret and deploy','Set APP_SECRET with npx wrangler secret put APP_SECRET. Use at least 32 random bytes. Run npm run deploy from server-worker; it applies D1 migrations before deploying the Worker.'],
 ['Finish setup','Open your Worker URL followed by /setup, create the owner and save your recovery codes. D1 and R2 persist when the Worker code is redeployed.']
 ]],
 ['local','Local development','GET STARTED',[
 ['Install dependencies','Clone the repository, use Node 24, and run npm ci. Run npm run dev:demo for the browser-only backend. No PHP process or external service is required for the demo.'],
 ['Production adapters','npm run dev starts Vite and PHP; npm run dev:worker starts Vite and Wrangler. Local PHP data lives in .data, outside the server’s public directory.'],
 ['Build and package','npm run build creates app/dist and landing/dist. npm run build:pages creates site with the /wavehaus/ base. npm run package creates both production archives. The repository retains its test commands; publication is build-only at the owner’s request.']
 ]],
 ['upload-organise','Upload & organise','YOUR LIBRARY',[
 ['Bring your music','Choose files, choose a folder or drop audio on Upload music. All music remains private by default. In demo mode uploads stay in this browser and are removed if you clear its site data.'],
 ['Your browser does the work','The browser reads tags, extracts artwork, creates waveform peaks and guesses names. Complete tags win, then folder structure, then filenames. No server-side parsing or transcoding is required.'],
 ['Original files','Wavehaus stores the originals. Playback depends on the codecs your browser supports. A format the device cannot play is reported clearly; it is never silently converted.'],
 ['Review and fix in bulk','The import review shows guesses and confidence before you apply them. Multi-select tracks to edit tags, rename from a pattern, apply artwork or change visibility. Activity can undo a batch for 30 days; conflicts preserve newer edits.']
 ]],
 ['offline','Offline & downloads','YOUR LIBRARY',[
 ['Download a collection','Use Download on an album, playlist or track. Two files download at once; the original audio is kept on this browser. Use Downloads to retry failures or remove copies. Cancelling a download does not delete the server original.'],
 ['Storage and persistence','Settings → Storage & backups shows browser usage and your downloaded audio total. Keep downloads on this device requests persistent storage; the browser decides whether to grant it. Clearing site data or signing out removes offline copies.'],
 ['Offline access','Open Wavehaus while signed in at least once before going offline. The cached library stays available within that session’s expiry. When connected, permissions are checked again; disconnected devices learn about revoked sharing on reconnection.']
 ]],
 ['lyrics-moments','Lyrics, moments & loops','YOUR LIBRARY',[
 ['Lyrics that follow','Import embedded USLT/SYLT lyrics or a matching song-name.lrc beside its audio file. Open Lyrics from Now Playing. Timestamped lines follow playback; tap a line to seek or turn Follow off to read freely.'],
 ['Keep a moment','Hold the Now Playing waveform for half a second or use Save moment. Add an optional label. Markers seek to that timestamp; the Moments list provides edit and delete. Your moments are private and searchable.'],
 ['Loop a section','Set A at the section start, then B at its end. Drag the waveform handles or use arrow keys (Shift for larger steps); numeric controls offer another way to choose times. Clear loop resumes normal playback. Changing tracks clears the loop.']
 ]],
 ['private-public','Private & public','YOUR LIBRARY',[
 ['Private means only you','Every upload starts private. Only its uploader can see and play a private track. Even the server owner cannot listen to another member’s private music.'],
 ['Public means signed-in members','Public music is available to signed-in members of your server. It is not anonymous access. Share only music you have the rights to share. Uploads default to Private in both demo and production.'],
 ['Share at the right level','Visibility controls let you share tracks, whole albums, folders or playlists. Publishing shows the exact number of affected tracks first. Other members’ tracks keep their own settings.'],
 ['A playlist protects private tracks','A public playlist only shows tracks its viewer can play. It does not reveal hidden track names, counts or durations. Making an item private removes it from other members’ devices on the next sync.']
 ]],
 ['members','Members & access','YOUR SERVER',[
 ['Closed by default','A new Wavehaus server starts Closed: only the owner can sign in. In Access & members choose Invite only, Request access or Open registration. Requests need approval; registration uses local proof-of-work and rate limits.'],
 ['Roles and quotas','Owners manage the server. Admins manage members without listening to private music. Uploaders can add their own files; listeners play shared tracks and keep their own playlists and likes.'],
 ['Recovery without email','Save your recovery codes when creating an account. A recovery code can reset the password once and revokes existing sessions. Email is never required.']
 ]],
 ['updating','Updating safely','YOUR SERVER',[
 ['Code and data are separate','Your hosting-home wavehaus-data directory holds the SQLite database, media, art, temporary uploads and backups. The application directory holds replaceable code. Never delete the data directory to update the app.'],
 ['Shared hosting','Download the next verified release, upload it into the same app directory and extract with overwrite. The migration runner first makes a consistent SQLite backup, takes a lock, and applies each migration once. Settings stay in the database.'],
 ['Cloudflare','Apply D1 migrations before wrangler deploy. Keep the existing database and R2 bucket bindings. Deploying code does not replace either resource.'],
 ['Rollback','Pause writes before restoring. Keep a copy of the current database, then restore a database snapshot matching the older code and preserve its media/art/config. Older code refuses a newer schema. On Cloudflare use a matching D1 export/recovery point and the corresponding Worker release.']
 ]],
 ['backups','Backups','YOUR SERVER',[
 ['What to save','Back up the complete wavehaus-data directory: the database, config, media and art. cPanel Home Directory Backup can do this without a terminal. Protect the archive because it contains private music and server secrets.'],
 ['Database snapshots','PHP keeps the five most recent pre-migration SQLite snapshots. A database backup alone does not include the media files; copy those too.'],
 ['Cloudflare backups','Export D1 and keep a separate copy of R2 media. Keep secrets outside version control. Restore D1 with its matching Worker code and media objects; deploys alone do not back up R2.']
 ]],
 ['assistants','API & assistants','YOUR SERVER',[
 ['Start with the normal UI','Ask Claude or Codex to open your signed-in Wavehaus in its browser. Use Upload music’s labelled file inputs. All changes stay private unless you explicitly choose to publish.'],
 ['A useful first request','“Upload this folder, tidy the tags, find the official artwork and keep everything private.” The assistant uses the same screens as you. Never put passwords into prompts.'],
 ['Tokens and MCP','Settings → AI assistants provides scoped, expiring API tokens and configuration for tools/mcp.mjs included in both release archives. The core Node stdio server needs no runtime dependency; optional local music-metadata and sharp add tags and resizing. Tokens can be restricted to reading, uploading, organising or administration. Raw tokens are displayed once and can be revoked.'],
 ['Activity and undo','Settings → Activity attributes actions to a browser or named API token and can filter by actor. Metadata, artwork, visibility and playlist batches support 30-day Undo. If newer changes conflict, keep those rows and undo the unchanged rows.']
 ]]
];
export const faq=[['Does this work in Chrome?','Audio usually keeps playing in Chrome on Android. Device battery settings can still interrupt it. Brave with Background play enabled is the documented route.'],['Do I need a native app?','No. Wavehaus installs from the browser. On Android, use Brave’s Install app or Add to Home screen menu.'],['Will it always work on iPhone?','iPhone background playback is best effort. Use Brave as a tab with Enable Background Audio on. A standalone home-screen web app may pause; use the shortcut methods above.'],['What about my lock screen?','Wavehaus uses Media Session for artwork, play, pause, skip and seeking. The controls available depend on your browser and operating system.']];
