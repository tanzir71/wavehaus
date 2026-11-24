// Only these read endpoints are available without an account. All mutations
// and account-specific reads still pass through required authentication.
export const publicReadPath=(path:string)=>/^\/api\/(?:library|search|tracks|albums(?:\/[0-9A-HJKMNP-TV-Z]{26})?|playlists(?:\/[0-9A-HJKMNP-TV-Z]{26}(?:\/items)?)?)$/.test(path);
