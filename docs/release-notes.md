Wavehaus v1.1.0 makes desktop chrome and lists more compact at 1100 px and above.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Open Home at 1440 × 900, then resize to 1100: the sidebar, quick tiles, mix grid and headings use desktop density.
2. Open an album, Upload, Bulk edit, Access & members and AI assistants to review shorter rows, controls and panels.
3. Switch to a phone or tablet and check playback: mobile/tablet layouts and the listening areas keep their 1.0 sizes.

The two archives contain the same frontend for PHP shared hosting and Cloudflare Workers. No schema, API, stored data or playback behavior changed. Keep your existing private data, configuration and bindings when upgrading.

Validation and known pre-existing test failures are recorded in docs/desktop-density-checks.md. Physical Android Brave screen-off playback and Lighthouse were not remeasured for this visual pass.
