Wavehaus v0.2.1 corrects the landing product mockups and the fullscreen footer.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Compare the desktop/mobile previews and the three feature crops with the approved design.
2. Inspect the access panel: dark selected tab, two toggles, RK avatar and one compact request row.
3. Press End on a fullscreen desktop window; the footer credits should remain visible.

The mockups are native HTML/CSS with the actual Figma artwork, icons and waveforms. They scale proportionally and need no browser JavaScript. Fixed preview geometry allows their interiors to render lazily without changing the document height. The closing wave spans wide displays, and the footer uses the designed compact spacing.

Validated at 412, 768, 1440 and 1920 px wide. Landing, Background play and shared-hosting docs measured 100/100/100/100 in Lighthouse. Android and desktop browser checks cover one-jump footer reachability, local preview artwork and all 15 static pages without JavaScript. See docs/landing-fix-verification.md.

Both server archives retain the M2 feature set. Playback hardening continues in M3. Physical screen-lock playback and OS-level share-sheet delivery remain unverified.
