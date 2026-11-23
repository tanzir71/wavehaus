# Wavehaus MCP server

Node 18 or newer. The core stdio server uses only Node built-ins. It ships with its built organiser and CLI files in both server archives. In a source checkout, run `npm ci` and `npm run build` once to produce tools/dist.

Add a server to your MCP client, using an absolute path to tools/mcp.mjs:

```json
{"mcpServers":{"wavehaus":{"command":"node","args":["/absolute/path/to/wavehaus/tools/mcp.mjs"],"env":{"WAVEHAUS_URL":"https://music.example.com/","WAVEHAUS_TOKEN":"YOUR_TOKEN"}}}}
```

Use the final base URL, including a custom path such as /music/ when configured. Obtain a token from Settings → AI assistants on the self-hosted PHP or Worker installation. The Pages demo has no HTTP API; its browser-local tokens cannot connect a separate Node process. Never put a token in the repository or a shared prompt.

Recommended scopes: read, upload and organise. Admin is only for server management and does not grant playback of other members' private music. Browser security settings and token management require a signed-in browser session.

Tools: search_library, list_albums, get_album, preview_organise, bulk_update, rename_by_pattern, upload_files, set_artwork, set_visibility, create_playlist, add_to_playlist, list_changes, undo_change.

Preview organisation and rename patterns before applying. Public visibility requires a dry-run, reporting the counts, explicit authorization and the returned previewRevisions. Private is the default. Existing duplicate files are skipped rather than changed. New private CLI uploads override inherited album/folder public defaults. If an existing upload or a server policy yields another visibility, the result reports it for a separate visibility decision.

Upload accepts files and folders, uses streamed hashes and resumable chunks, optionally reads music-metadata tags, and shares the app's organiser. Without that optional peer it uses folder/filename rules and duration can arrive during playback. Peaks can be backfilled by the browser; missing peaks display a flat line. Covers use optional sharp when installed; otherwise the original PNG/JPEG/WebP is retained (5 MB maximum). No server-side tag parsing or resizing is required. Remote cover URLs must be public HTTPS and resolve to public addresses; redirects stay on the same origin.

Protocol: newline-delimited JSON-RPC on stdin/stdout. Supports 2026-07-28 per-request metadata/discovery and initialization-based 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05 clients. Results, tool errors and progress use the protocol channel; credentials are never logged. Cancellation stops in-flight work and leaves uploads resumable. See the official [stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio), [discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) and [version compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) specifications.
