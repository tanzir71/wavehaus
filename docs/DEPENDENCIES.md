# Dependency decisions

The runtime and npm build/test dependencies are exactly the handover’s approved list. Versions are pinned in package.json and the lockfile. No CSS framework, router library, service-worker framework or audio encoder is used.

- `music-metadata` and the Upload route are dynamically imported. The service worker precaches only the shell; it does not preload those lazy modules.
- `sharp` creates responsive AVIF/WebP landing images, square notification artwork and the OG image during the build.
- Lighthouse CLI 13.6.0 is an ephemeral verification tool used to measure the required acceptance scores. It is not a package dependency and ships no code to the site.
- FontTools 4.63.0 was used as an optional asset-maintenance tool to subset the landing fonts to Latin, punctuation, arrows and the moment/check glyphs. The subset WOFF2 files are committed, so neither FontTools nor Python is needed to build or deploy. The PWA retains the full official Geist variable fonts for user-supplied track names. Both copies include the OFL license.
- The background-test audio is generated as PCM WAV by `scripts/make-chime.mjs`, rather than an MP3 that would require an encoder. It is 45 seconds with a chime at 30 seconds, with a correct `.wav` name and MIME type.

Wrangler 4.166.0 is pinned separately in `server-worker/package.json` as deployment/local-test tooling. It is required to build/deploy and emulate D1/R2, and ships no dependency in the frontend or PHP runtime. The Worker source uses WebCrypto and platform bindings directly, without a framework.

Pairing uses a small local QR encoder (Model 2, version 6/L), independently decoded with OpenCV 4.12.0 during verification. Neither QR generation nor pairing sends secrets to an external service. OpenCV is an optional verification tool only.

Release archives use Node's built-in zlib and a ZIP writer. The independent archive/redeploy test uses Python's standard-library zipfile/SQLite/HTTP modules; no Python package or Python runtime is needed to build, package or host Wavehaus.

M2's committed audio fixtures are original generated tones. The optional maintenance generator uses installed SoundFile 0.13.1/libsndfile and NumPy to encode PCM directly into the test formats; it does not use ffmpeg or transcode user music. Those tools are not build, runtime or CI dependencies.

The M4A fixture is original ALAC audio written by a small standard-library Python generator, using the documented escape-packet format and MP4 sample tables. Its packets were independently decoded with libsndfile and matched the generated PCM exactly. The installed Chromium does not decode ALAC; tags and upload support do not imply that every browser can play every codec. No encoder is shipped in Wavehaus.

Large-file acceptance uses legal FLAC padding metadata around an original two-second stream. The ignored 300 MB artifact independently decodes to the same PCM as the tiny fixture, and is generated with Node's standard library during tests.
