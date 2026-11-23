# Landing product mockups

These are native HTML and plain CSS translated from the approved Figma file
`jpktTO1igsegz2iP68nsRd` using `get_design_context`, with the actual exported
artwork, icons and waveforms stored in `../assets/mockups/`.

| Fragment | Figma node |
| --- | --- |
| Android lock screen | `45:470` in `28:197` |
| Desktop Home | `28:229` in `28:225` |
| Mobile Now Playing | `28:326` in `28:225` |
| Review / Upload / Discovery crops | `46:491` / `46:576` / `46:615` in `28:391` |
| Activity | `47:691` |
| Visibility | `47:765` |
| Access | `48:712` |

The `data-node-id` attributes retain the design mapping. `design.css` contains
the translated declarations, without a CSS framework or browser JavaScript.
The SVG viewBox in `../mockups.mjs` scales the HTML previews proportionally at
different viewport widths; it contains a `foreignObject`, not a screenshot.
The surrounding headings, feature copy, links, navigation and footer remain
responsive HTML. These previews describe product screens and have image labels;
their illustrated controls are not interactive controls.

PNG artwork is converted to WebP (at most 600 px wide) during import; the
original composition and aspect ratio are retained. No temporary Figma URL is
used at runtime. No new dependency was added.
