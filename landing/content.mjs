export const docs=[
 ['','Overview','GET STARTED',[
 ['Your music, at home','Wavehaus is a music streaming PWA for your own audio files. Upload from a phone or computer, organise the library in your browser, and listen anywhere. The M0 preview stores everything in your current browser.'],
 ['Choose your home','Use PHP 8.1+ and SQLite on shared hosting, or Cloudflare Workers with R2 and D1. Production packages begin with M1; the browser demo is available now.'],
 ['Install and listen','Open Wavehaus in Brave on Android, use Install app or Add to Home screen, then follow the Background play guide. No app store is needed.']
 ]],
 ['shared-hosting','Install on shared hosting','GET STARTED',[
 ['Before you start','You need a domain or subdomain with HTTPS, PHP 8.1 or newer, and the pdo_sqlite, fileinfo, mbstring and openssl extensions. Apache or LiteSpeed must allow .htaccess routing. A Namecheap-class shared host is enough.'],
 ['1. Download the release','Download wavehaus-shared-hosting-vX.Y.Z.zip from GitHub Releases. Production packages begin with M1. M0 is the installable browser demo; try it from the link above while the server package is being built.'],
 ['2. Upload and extract','In cPanel, create music.yourdomain.com. Open File Manager, go to its document root, upload the release zip and choose Extract. No terminal, Composer or Node is needed on the host.'],
 ['3. Keep your data outside the web root','Create a wavehaus-data folder in your hosting home, beside public_html. Your database, media, artwork and backups live here. Release updates replace code only. If your host cannot do this, setup uses a protected data directory and tells you its exact location.'],
 ['4. Open setup','Visit https://music.yourdomain.com/setup. The requirements check lists any missing extension or permission and its fix. Create your owner account, choose a server name, and save the ten recovery codes. Email is optional.'],
 ['5. Add music and install','Open Upload music, choose files or a folder, then check the import review. Open your server in Brave on your phone, install it from the menu and run the Background play test.'],
 ['Updating safely','Extract the next release over the app files. Keep wavehaus-data in place. The first request makes a database backup and applies pending migrations under a lock. See Updating safely for the full procedure.']
 ]],
 ['cloudflare','Install on Cloudflare','GET STARTED',[
 ['Before you start','Use a Cloudflare account and Node locally for Wrangler. Workers Paid is recommended for password hashing. R2 storage may have usage charges; check Cloudflare’s current pricing. No Node process runs on the server.'],
 ['Create the database and bucket','Download the Worker release when available. Run npx wrangler login, npx wrangler d1 create wavehaus and npx wrangler r2 bucket create wavehaus-media. Paste your database ID into wrangler.toml.'],
 ['Add a secret and deploy','Set APP_SECRET with npx wrangler secret put APP_SECRET. Use at least 32 random bytes. Run npm run deploy from server-worker; it applies D1 migrations before deploying the Worker.'],
 ['Finish setup','Open your Worker URL followed by /setup, create the owner and save your recovery codes. D1 and R2 persist when the Worker code is redeployed.']
 ]],
 ['local','Local development','GET STARTED',[
 ['Install dependencies','Clone the repository, use Node 24, and run npm ci. Run npm run dev:demo for the browser-only backend. No PHP process or external service is required for the demo.'],
 ['Production adapters','From M1, npm run dev starts Vite and PHP; npm run dev:worker starts Vite and Wrangler. Local PHP data lives in .data, outside the server’s public directory.'],
 ['Build and test','npm run build creates app/dist and landing/dist. npm run build:pages creates site with the /wavehaus/ base. npm run lint, npm test, npm run test:api and npm run e2e check types, behavior, the API contract and browser flows.']
 ]],
 ['upload-organise','Upload & organise','YOUR LIBRARY',[
 ['Bring your music','Choose files, choose a folder or drop audio on Upload music. All music remains private by default. In demo mode uploads stay in this browser and are removed if you clear its site data.'],
 ['Your browser does the work','The browser reads tags, extracts artwork, creates waveform peaks and guesses names. Complete tags win, then folder structure, then filenames. No server-side parsing or transcoding is required.'],
 ['Original files','Wavehaus stores the originals. Playback depends on the codecs your browser supports. A format the device cannot play is reported clearly; it is never silently converted.'],
 ['Review and fix in bulk','The import review and bulk editor arrive in M4. You will be able to inspect guesses, rename from a pattern and undo a batch for 30 days.']
 ]],
 ['private-public','Private & public','YOUR LIBRARY',[
 ['Private means only you','Every upload starts private. Only its uploader can see and play a private track. Even the server owner cannot listen to another member’s private music.'],
 ['Public means signed-in members','Public music is available to signed-in members of your server. It is not anonymous access. Share only music you have the rights to share. The M0 demo keeps all uploads private.'],
 ['Share at the right level','The M7 visibility controls let you share tracks, whole albums, folders or playlists. Publishing shows the exact number of affected tracks first. Other members’ tracks keep their own settings.'],
 ['A playlist protects private tracks','A public playlist only shows tracks its viewer can play. It does not reveal hidden track names, counts or durations. Making an item private removes it from other members’ devices on the next sync.']
 ]],
 ['members','Members & access','YOUR SERVER',[
 ['Closed by default','A new Wavehaus server accepts only people the owner invites. M7 adds Invite only, Request access and Open registration modes.'],
 ['Roles and quotas','Owners manage the server. Admins manage members without listening to private music. Uploaders can add their own files; listeners play shared tracks and keep their own playlists and likes.'],
 ['Recovery without email','Save your recovery codes when creating an account. A recovery code can reset the password once and revokes existing sessions. Email is never required.']
 ]],
 ['updating','Updating safely','YOUR SERVER',[
 ['Code and data are separate','Your hosting-home wavehaus-data directory holds the SQLite database, media, art, temporary uploads and backups. The application directory holds replaceable code. Never delete the data directory to update the app.'],
 ['Shared hosting','Download the next verified release, upload it into the same app directory and extract with overwrite. The migration runner first makes a consistent SQLite backup, takes a lock, and applies each migration once. Settings stay in the database.'],
 ['Cloudflare','Apply D1 migrations before wrangler deploy. Keep the existing database and R2 bucket bindings. Deploying code does not replace either resource.'],
 ['Rollback','Extract the previous code release. If a migration ran, restore the matching database backup and keep a copy of the newer database before restoring. Read the release notes for version-specific requirements.']
 ]],
 ['backups','Backups','YOUR SERVER',[
 ['What to save','Back up the complete wavehaus-data directory: the database, config, media and art. cPanel Home Directory Backup can do this without a terminal. Protect the archive because it contains private music and server secrets.'],
 ['Database snapshots','PHP keeps the five most recent pre-migration SQLite snapshots. A database backup alone does not include the media files; copy those too.'],
 ['Cloudflare backups','Export D1 and keep a separate copy of R2 media. Keep secrets outside version control. Test a restore into a separate instance before relying on your backup.']
 ]],
 ['assistants','API & assistants','YOUR SERVER',[
 ['Start with the normal UI','Ask Claude or Codex to open your signed-in Wavehaus in its browser. Use Upload music’s labelled file inputs. All changes stay private unless you explicitly choose to publish.'],
 ['A useful first request','“Upload this folder, tidy the tags, find the official artwork and keep everything private.” The assistant uses the same screens as you. Never put passwords into prompts.'],
 ['Tokens and MCP','M8 adds scoped API tokens and a zero-dependency stdio MCP server. Tokens can be restricted to reading, uploading, organising or administration. Raw tokens are displayed once and can be revoked.'],
 ['Activity and undo','Completed uploads appear in Settings → Activity in M0. Reversible batch edits and 30-day undo arrive in M4; assistant actor filtering follows in M8.']
 ]]
];
export const faq=[['Does this work in Chrome?','Audio usually keeps playing in Chrome on Android. Device battery settings can still interrupt it. Brave with Background play enabled is the documented route.'],['Do I need a native app?','No. Wavehaus installs from the browser. On Android, use Brave’s Install app or Add to Home screen menu.'],['Will it always work on iPhone?','iPhone background playback is best effort. Use Brave as a tab with Enable Background Audio on. A standalone home-screen web app may pause; use the shortcut methods above.'],['What about my lock screen?','Wavehaus uses Media Session for artwork, play, pause, skip and seeking. The controls available depend on your browser and operating system.']];
