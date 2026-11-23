# Optional PHP media offloading

Normal PHP streaming is the default and requires no server modules. It supports
authenticated GET/HEAD, single byte ranges, ETag and If-Range. All authorization
checks happen before the streaming or offload branch. Artwork stays on its
existing authenticated path.

Offload flags belong in the private `wavehaus-data/config.php`, alongside
`APP_SECRET`. Preserve that file when replacing application code.

## Apache with mod_xsendfile

Ask the host to enable `mod_xsendfile` and allowlist only the absolute media
directory, for example:

```apache
XSendFile On
XSendFilePath /home/your-account/wavehaus-data/media
```

Then add this to private `config.php`:

```php
define('MEDIA_OFFLOAD', 'x-sendfile');
```

The application sends a 200 handoff without a body or partial Content-Length;
Apache handles the actual byte ranges. Wavehaus handles malformed ranges before
handoff and keeps its own private cache policy and ETag. The module must be
enabled before setting this flag. Remove the flag to return to PHP streaming.
`XSendFilePath` is a server/vhost/directory directive, so a shared-hosting
operator may need to configure it.
The web-server process needs read access to the media files and traversal of
their parent directories; the host should grant that narrowly without making
the configuration or database readable through a public URL.

## LiteSpeed with a protected context

Map a dedicated URI such as `/__wavehaus_media/` to **only** the existing private
`wavehaus-data/media` directory, using a host-managed static context. Do not map
the database, configuration, uploads directory or the whole data directory.

Protect that context with a rewrite rule based on LiteSpeed's original request
URI. An internal redirect is allowed only when the original URI was the
authenticated Wavehaus media endpoint. For an app installed at `/`:

```apache
RewriteCond %{ORG_REQ_URI} !^/media/[0-9A-HJKMNP-TV-Z]{26}(?:\?.*)?$
RewriteRule ^ - [F,L]
```

For `/music/`, the condition starts `!^/music/media/` instead. Apply these rules
in the protected context itself, with rewriting enabled. The context must allow
the authenticated internal redirect while denying direct requests, including
encoded URI variants. Do not weaken the private data directory's protection.
Have the host configure the specific media context rather than moving data
into public storage.

Only after configuring that mapping, add:

```php
define('MEDIA_OFFLOAD', 'litespeed');
define('MEDIA_OFFLOAD_URI', '/__wavehaus_media/');
```

LiteSpeed takes a URI, not a filesystem filename. The code checks the canonical
media path and the owner/hash shape before building this header. The context
prefix cannot contain traversal, a hostname, a query, escaping or control bytes.

## Check the host configuration

With a private track, verify all of these before leaving offloading enabled:

1. Signed-out `/media/<track-id>` returns 401; another member's private track is
   denied. A signed-in authorized GET plays the file.
2. Signed-in HEAD returns the file size with no body. `Range: bytes=0-43`
   returns 206, 44 bytes and the correct Content-Range. An out-of-range request
   returns 416. Check suffix ranges and If-Range as well.
3. For LiteSpeed, direct requests to the mapped owner/hash URI, including encoded
   prefix variants, return 403/404 and no audio bytes. Neither offload header
   should reach the client.

The ordinary PHP path and header/path validation are exercised locally. CI also
runs the full API and browser server checks through an actual Apache
`mod_xsendfile` proxy using disposable data. A real LiteSpeed installation is not
available in the local environment; its context configuration needs the checks
above on the chosen host.

Sources: [Apache module configuration and range support](https://tn123.org/mod_xsendfile/),
[LiteSpeed internal redirects and original-URI protection](https://docs.litespeedtech.com/lsws/redirect/).
