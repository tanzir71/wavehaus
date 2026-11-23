import { readFile } from 'node:fs/promises';

const fragments = Object.fromEntries(await Promise.all(
  ['desktop', 'now-playing', 'review', 'upload', 'discovery', 'activity', 'visibility', 'access', 'phone']
    .map(async name => [name, await readFile(new URL(`mockups/${name}.html`, import.meta.url), 'utf8')])
));

// The viewBox scales the native HTML mockups together, including text, artwork and
// controls. Only the deliberately cropped product previews hide their lower edge.
function canvas(html, width, height, label, base, className = '') {
  return `<svg class="design-preview ${className}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${label}"><foreignObject width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" class="design-canvas" style="width:${width}px;height:${height}px">${html.replaceAll('src="assets/', `src="${base}assets/`)}</div></foreignObject></svg>`;
}

export const productMockup = base => canvas(fragments.desktop + fragments['now-playing'], 1200, 570, 'Wavehaus desktop Home and mobile Now Playing previews', base, 'product-preview');
export const phoneMockup = base => canvas(fragments.phone, 320, 660, 'Android lock screen playing Afterglow in Brave with Background play on', base, 'lock-preview');
export const featureMockup = (name, base) => canvas(fragments[name], 384, 300, `${name === 'review' ? 'Review import' : name === 'upload' ? 'Upload music' : 'Made for you'} product preview`, base);
export const panelMockup = (name, base) => canvas(fragments[name], 680, {activity:466, visibility:464, access:428}[name], `${name === 'activity' ? 'Activity attributed to an assistant with Undo' : name === 'visibility' ? 'Album visibility and the tracks it affects' : 'Invite-only access, member quotas and a pending request'} preview`, base);
