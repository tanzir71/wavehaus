# Wavehaus shared hosting — M2

Owner setup, sign-in, recovery, device pairing, settings, resumable uploads, artwork, library sync and authenticated streaming are implemented. Playback hardening continues in M3. The Pages demo uses its own browser-local backend.

1. In cPanel create a subdomain, with PHP 8.1+ and the pdo_sqlite, mbstring, openssl and fileinfo extensions enabled.
2. Upload and extract the shared-hosting zip into that domain's document root. Enable HTTPS. Apache/LiteSpeed must honour the included `.htaccess`.
3. Create `~/wavehaus-data` outside the web root, writable by PHP. Wavehaus discovers it on Namecheap-style layouts. Set the `WAVEHAUS_DATA_DIR` server environment variable if you need another path. If the host restricts outside storage, Wavehaus creates a random protected `data-*` directory under the document root; preserve it when updating.
4. Visit `/setup`, create the owner and save all ten recovery codes. Setup locks permanently after the first account exists.
5. On your second device, open the site and use a pairing code from Settings → Devices.

The production app defaults to `/`. For an existing website's subpath, set `APP_BASE` (for example `/music/`) before `npm run package`, then extract into that website's corresponding folder. Preserve the same base on later builds to keep the installed PWA identity stable. The project landing remains on GitHub Pages; visitor websites are outside this package.

At a custom base, open `/music/setup` instead of `/setup`. Upload chunks adapt to the host's PHP limits; the supplied `.user.ini` permits 8 MB chunks where supported. Files are verified without loading the whole upload into memory. Tags, artwork and waveforms are processed in the browser; no server encoder or media parser is needed.

Updates: overwrite application files from a new release zip. Keep the private data directory, its `config.php`, SQLite file, media and backups. The archive contains no live settings or data. The first request applies pending migrations under a file lock, making a consistent SQLite backup first. Settings stay in the database.

Recovery: use one saved code with your username on the sign-in screen. If all codes are lost, add `define('RESET_OWNER', 'a-long-random-string');` to the private `config.php`, visit `/setup/reset` and enter that string. It is removed after use. Follow the screen if manual removal is necessary.

Do not serve the site using a static-only host or ignore `.htaccess`. Test that `/lib/bootstrap.php`, `/migrations/0001_init.sql`, `/data-*/config.php` and dotfiles return 403/404 before adding personal music.

No Composer, Node, shell access or external auth service is required on the host. The zip includes the built PWA.
