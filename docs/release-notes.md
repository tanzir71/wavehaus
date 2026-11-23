Wavehaus M8 adds assistant operation, scoped API tokens and a local MCP server.

Preview: https://tanzir71.github.io/wavehaus/
App: https://tanzir71.github.io/wavehaus/app/

What to try:
1. Open AI assistants, create a named token with scopes and expiry, and save its one-time value.
2. Use the browser upload/review/bulk controls, then filter Activity by Browser or API.
3. Copy tools from a production archive and configure your MCP client with your own server URL and token.

Both server archives include the built Node stdio server and shared organiser. It supports local tag reading when music-metadata is installed, falls back to folder/filename rules, resumes chunks and keeps new uploads private. Artwork uses optional sharp or a validated original. No runtime dependency is required for the core CLI server; existing optional libraries were not added to the dependency budget.

Token authentication, scopes, expiry, rate limits and attribution are implemented on PHP, Worker and the browser demo. Conflict-aware Undo can retain newer rows and restore the remaining rows with relationship guards. Protocol support includes modern request metadata and legacy initialization.

As requested, only builds needed for packaging and publication were run. No further tests, browser checks, Lighthouse runs or physical-device checks were performed.
