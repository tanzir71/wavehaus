import { describe, expect, it } from 'vitest';
import { canVisitSignedOut, isPublicGuide } from '../../app/src/ui/public-route';
describe('links from the website landing', () => {
  it('opens the install guide and request form before sign-in', () => {
    expect(isPublicGuide('/background-play')).toBe(true);
    expect(canVisitSignedOut('/background-play')).toBe(true);
    expect(canVisitSignedOut('/join/request')).toBe(true);
  });
  it('allows the public player and keeps account routes behind authentication', () => {
    for(const path of ['/', '/library', '/search?q=music', '/album/123', '/now-playing', '/queue']) expect(canVisitSignedOut(path)).toBe(true);
    for (const path of ['/upload','/bulk-edit','/settings/access', '/background-play/private', '/join-other']) expect(canVisitSignedOut(path)).toBe(false);
  });
});
