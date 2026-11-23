# Wavehaus shared hosting — M1

This milestone supports owner setup, sign-in, recovery, device pairing and settings. Music upload/streaming on the production server arrives in M2/M3. The Pages demo already plays generated music.

1. In cPanel create a subdomain, with PHP 8.1+ and the pdo_sqlite, mbstring, openssl and fileinfo extensions enabled.
2. Upload and extract the shared-hosting zip into that domain's document root. Enable HTTPS. Apache/LiteSpeed must honour the included `.htaccess`.
3. Create `~/wavehaus-data` outside the web root, writable by PHP. Wavehaus discovers it on Namecheap-style layouts. Set the `WAVEHAUS_DATA_DIR` server environment variable if you need another path. If the host restricts outside storage, Wavehaus creates a random protected `data-*` directory under the document root; preserve it when updating.
4. Visit `/setup`, create the owner and save all ten recovery codes. Setup locks permanently after the first account exists.
5. On your second device, open `/app/` and use a pairing code from Settings → Devices.

Updates: overwrite application files from a new release zip. Keep the private data directory, its `config.php`, SQLite file, media and backups. The archive contains no live settings or data. The first request applies pending migrations under a file lock, making a consistent SQLite backup first. Settings stay in the database.

Recovery: use one saved code with your username on the sign-in screen. If all codes are lost, add `define('RESET_OWNER', 'a-long-random-string');` to the private `config.php`, visit `/setup/reset` and enter that string. It is removed after use. Follow the screen if manual removal is necessary.

Do not serve the site using a static-only host or ignore `.htaccess`. Test that `/lib/bootstrap.php`, `/migrations/0001_init.sql`, `/data-*/config.php` and dotfiles return 403/404 before adding personal music.

No Composer, Node, shell access or external auth service is required on the host. The zip includes the built PWA.
