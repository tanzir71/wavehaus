# M4 verification in progress

M4 is implemented on `milestone/m4` for v0.4.0. At the owner's request on 24 Nov 2026, subsequent work runs packaging/Pages builds only. The results below are historical checks from before that instruction, rather than claims of final test coverage.

Verified so far:

- 168 unit checks, including 73 hand-labelled organise fixtures and the shared metadata planner.
- Real PHP/SQLite and Worker/D1 integration: one 500-track PATCH, one journal, appended artwork, exact metadata/artwork Undo, stale and ownership guards, concurrent edits, SQL rollback, legacy journals, album reference guards and activity cursor ties.
- Actual album splits, whole-album renames, bulk artwork appended to the same action, public-to-private hidden sync and restoration on both server adapters.
- Authenticated API contract checks pass on PHP, Worker and demo, including metadata previews, CSRF, revision conflicts, deletion/Undo and stable separate-import keys.
- Existing auth/upload browser checks pass at Android and desktop sizes on both server adapters. The 300 MB cases were not rerun during this intermediate check; CI runs them for the milestone.
- Browser demo: 500 tracks renamed through the bulk editor with one metadata request and one journal; the toast's Undo restores all 500 titles. Desktop 1440×900 and mobile 412×915 render without horizontal overflow.
- Production build: 56.6 KiB initial JavaScript gzip, below the 90 KiB budget. Editor and artwork helpers are lazy chunks.

Final implementation adds persistent import review and batch Undo, compilation reconciliation, separate-import preservation, exact album merge targets, subset splitting, track/album privacy and shared artwork actions. Production release packaging and Pages builds produce the deliverables. No further tests are run.

Physical Android Brave/Chrome/iOS screen-lock and OS share-target checks remain device checks. Browser emulation does not establish those outcomes.
