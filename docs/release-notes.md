Wavehaus M7 adds private/public controls and member access management.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Make a playlist public with its own-track checkbox, then make it private in one tap.
2. Select folders or albums in Library and apply privacy together; Undo restores previous values.
3. Open Access & members, create an invitation, or choose a registration mode and manage requests.

The PHP, Worker and demo adapters support invitations, approval links, roles, quotas and ownership transfer. Registration uses self-hosted proof-of-work with expiring, single-use claims, a honeypot, minimum fill time and rate limits. Email remains optional. Folder visibility defaults persist through redeploys; public relationship revisions restore incremental library entries after republishing.

Publication builds completed: production initial JavaScript 61.7 KiB gzip, demo 73.7 KiB, Worker bundle 45.05 KiB gzip. Both production archives are attached. No new dependency. As requested, only builds needed for publication were run; no additional tests, browser checks or physical-device checks were performed.
