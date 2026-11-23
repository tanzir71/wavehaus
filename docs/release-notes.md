Wavehaus 1.0 completes milestones M0–M10.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Install the demo or deploy a server archive, add your music and use the Brave background-play guide.
2. Review imports, bulk-edit tags/artwork, manage private sharing and inspect attributed Activity/Undo.
3. Download an album, follow lyrics, save moments or loop a section; configure an assistant with a scoped token if desired.

The shared-hosting archive needs PHP 8.1+ and SQLite PDO, without Node/Composer on the host. The Worker archive uses Cloudflare D1/R2. Both include built PWA assets, migration 10 and optional local MCP tools. Keep private data/bindings/secrets on upgrades. Read the included install guide and back up data before updating.

This release adds explicit app-update controls, keyboard/focus and phone/iPhone polish, offline listening route precaching, bounded library rendering and complete product/operations docs. Initial JavaScript remains within the enforced 90 KB gzip budget; Upload and tag parsing are lazy.

The owner explicitly requested no further testing. Only production packaging, Worker compilation and Pages builds were run. Current browser/device behavior, accessibility and Lighthouse targets remain unverified. iPhone playback is best effort. P2 crossfade, ReplayGain and external share links remain outside 1.0.
