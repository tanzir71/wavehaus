import { describe, expect, it } from 'vitest';
import { canVisitSignedOut, isPublicGuide } from '../../app/src/ui/public-route';
describe('links from the website landing', () => {
  it('opens the install guide and request form before sign-in', () => {
    expect(isPublicGuide('/background-play')).toBe(true);
    expect(canVisitSignedOut('/background-play')).toBe(true);
    expect(canVisitSignedOut('/join/request')).toBe(true);
  });
  it('keeps library and account routes behind authentication', () => {
    for (const path of ['/', '/library', '/settings/access', '/background-play/private', '/join-other']) expect(canVisitSignedOut(path)).toBe(false);
  });
});
