Wavehaus M1 adds owner setup, secure sign-in, ten one-use recovery codes, device pairing and session management on both PHP and Cloudflare Workers. The release includes the first shared-hosting and Worker zips, with installation and update instructions inside.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Open Settings → Security, regenerate the demo recovery codes using `wavehaus-demo`, and save the codes before continuing.
2. In Settings → Devices, create a QR/six-digit pairing code, then sign out and try signing back in.
3. Install a server zip on a test host, create the owner at `/setup`, and pair a second browser from Devices.

The Pages demo starts signed in as `demo`; its initial password is `wavehaus-demo`. Demo pairing is simulated in the same browser. Server sessions use Secure, HttpOnly, SameSite=Lax `__Host-` cookies, with no external auth provider.

Validation: shared auth/API contracts on demo, PHP and Worker; Android and desktop browser checks; independent ZIP validation, password rehash and owner-reset checks; two code overwrites preserve accounts, settings, sessions, secrets, media and player state, including the protected fallback data directory.

Production uploads/streaming arrive in M2/M3, member registration in M7. Physical Android/iPhone background-play acceptance remains unverified. Full progress is in `docs/PROGRESS.md`; this is a milestone preview, not the final 1.0 release.
