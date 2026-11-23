# Landing design correction — v0.2.1

The reported fullscreen crop was reproduced: after one End key press, deferred
section sizing changed document height and left the footer below the viewport.
At 1920×820 the old footer credit was still over 1,000 px below the viewport.
Removing that section sizing makes the same jump reach the actual document end.
Only fixed-size preview interiors retain `content-visibility`, which does not
change the reserved height of their surrounding viewBoxes.

The Figma reference was read with `get_design_context`, including its rendered
screenshots. `landing/mockups/README.md` records the node IDs. The simplified
illustrations were replaced with translated native HTML/CSS and the actual
design assets. Screenshots are verification references, not implementation assets.

Checks performed:

- TypeScript and Worker TypeScript passed; 23 existing unit checks passed.
- Landing browser checks passed on Android 412×915 and desktop, including a
  1920×820 fullscreen viewport: one End press shows the whole credit line, the
  document is at the bottom, no horizontal overflow, and the wave spans the viewport.
- All 15 static routes work without JavaScript in Android and desktop checks.
- Additional manual automation checked 768×1024 and 1440×900. All four widths
  reached the footer credits in one jump, with no horizontal overflow.
- All 153 image callsites decoded successfully with nonzero rendered geometry;
  the browser reported no page errors. Native lazy images deliberately below
  the feature crops do not need to load until their clips expose them.
- Lighthouse 13.6 mobile: landing, Background play and shared-hosting docs each
  scored 100 performance / 100 accessibility / 100 best practices / 100 SEO.
- Demo initial JavaScript remains 54.5 KiB gzip. No new dependency was added.

The mockups are labelled static previews. Their illustrated controls are not
functional controls. Production app behavior is unchanged apart from the version.
This does not establish physical Android or iPhone behavior.
