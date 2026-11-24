// The installation guide contains no member data and is useful before sign-in.
export const isPublicGuide = (path: string) => path.split('?')[0] === '/background-play';
export const canVisitSignedOut = (path: string) => isPublicGuide(path) || path.split('?')[0]==='/' || /^\/(search|library|album|artist|folder|mix|playlist|now-playing|queue|sign-in|pair|join|setup\/reset)(\/|\?|$)/.test(path);
