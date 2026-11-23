<?php
declare(strict_types=1);

// Private-directory discovery, atomic writes and error copy are adapted from
// the owner's Tack backend/bootstrap.php. See REFERENCES.md for the port map.
ini_set('display_errors', '0');
const WH_VERSION = '0.1.0';
const WH_SCHEMA = 2;

final class ApiException extends RuntimeException {
    public function __construct(public string $errorCode, string $message, int $status = 400, public ?int $retryAfter = null) { parent::__construct($message, $status); }
}
function fail(string $code, string $message, int $status = 400, ?int $retryAfter = null): never { throw new ApiException($code, $message, $status, $retryAfter); }
function now_ms(): int { return (int)floor(microtime(true) * 1000); }
function token(int $length = 32): string { return rtrim(strtr(base64_encode(random_bytes($length)), '+/', '-_'), '='); }
function ulid(): string {
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; $time = now_ms(); $id = '';
    for ($n = 0; $n < 10; $n++) { $id = $alphabet[$time % 32] . $id; $time = intdiv($time, 32); }
    foreach (unpack('C*', random_bytes(16)) as $byte) $id .= $alphabet[$byte & 31];
    return $id;
}
function reply(mixed $data, int $status = 200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    if ($status !== 204) echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    exit;
}
function body(): array {
    if (!str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) fail('json_required', 'Use JSON for this request.', 415);
    $raw = file_get_contents('php://input', false, null, 0, 1048577);
    if (strlen($raw) > 1048576) fail('too_large', 'Request is too large.', 413);
    try { $value = json_decode($raw ?: '{}', true, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException) { fail('invalid_json', 'Invalid JSON.'); }
    if (!is_array($value) || array_is_list($value) && count($value)) fail('invalid_json', 'Use a JSON object.');
    return $value;
}
function data_dir(): string {
    static $directory;
    if ($directory) return $directory;
    $custom = getenv('WAVEHAUS_DATA_DIR');
    $publicRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__) . '/public') ?: dirname(__DIR__) . '/public';
    $normalized = str_replace('\\', '/', $publicRoot);
    if ($custom) $directory = $custom;
    else {
        $home = getenv('HOME') ?: dirname($publicRoot);
        if (preg_match('~^(.*?)/public_html(?:/|$)~', $normalized, $match)) $home = $match[1];
        $directory = rtrim($home, '/\\') . '/wavehaus-data';
        if (str_starts_with(str_replace('\\', '/', $directory) . '/', rtrim($normalized, '/') . '/')) $directory = dirname($publicRoot) . '/wavehaus-data';
    }
    if (!$custom && (!is_dir($directory) && !@mkdir($directory, 0700, true) || !is_writable($directory))) {
        // Last resort for hosts with open_basedir restrictions. The discovered
        // directory and lock are never included in release archives.
        $lock = @fopen($publicRoot . '/.wavehaus-data.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) fail('data_not_writable', 'Create the data directory ' . $directory . ' and make it writable by PHP (chmod 755).', 503);
        try {
            $matches = array_filter(glob($publicRoot . '/data-*', GLOB_ONLYDIR) ?: [], fn($path) => preg_match('/^data-[a-f0-9]{24}$/D', basename($path)) && is_file($path . '/.wavehaus'));
            if (count($matches) > 1) fail('configuration', 'More than one Wavehaus data directory exists. Set WAVEHAUS_DATA_DIR to the directory to use.', 503);
            $directory = count($matches) ? reset($matches) : $publicRoot . '/data-' . bin2hex(random_bytes(12));
            if (!is_dir($directory) && !@mkdir($directory, 0700)) fail('data_not_writable', 'Create the data directory ' . $directory . ' and make it writable by PHP (chmod 755).', 503);
            if (file_put_contents($directory . '/.htaccess', "Require all denied\nDeny from all\n", LOCK_EX) === false || file_put_contents($directory . '/.wavehaus', 'Wavehaus private storage', LOCK_EX) === false) fail('data_not_writable', 'Make ' . $directory . ' writable by PHP (chmod 755).', 503);
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
    if (!is_dir($directory) && !@mkdir($directory, 0700, true)) fail('data_not_writable', 'Create the data directory ' . $directory . ' and make it writable by PHP (chmod 755).', 503);
    if (!is_writable($directory)) fail('data_not_writable', 'Make ' . $directory . ' writable by PHP (chmod 755).', 503);
    $resolved = realpath($directory);
    if (!$resolved) fail('data_not_writable', 'Could not resolve the data directory ' . $directory, 503);
    $directory = $resolved;
    if (!file_exists($directory . '/.htaccess') && file_put_contents($directory . '/.htaccess', "Require all denied\nDeny from all\n", LOCK_EX) === false) fail('data_not_writable', 'Make ' . $directory . ' writable by PHP (chmod 755).', 503);
    return $directory;
}
function app_secret(): string {
    $file = data_dir() . '/config.php';
    if (!file_exists($file)) {
        $lock = fopen(data_dir() . '/config.lock', 'c'); if (!$lock || !flock($lock, LOCK_EX)) fail('storage', 'Cannot lock server configuration.', 503);
        try { if (!file_exists($file)) { $content = "<?php\ndefine('APP_SECRET', '" . bin2hex(random_bytes(32)) . "');\n"; if (file_put_contents($file, $content, LOCK_EX) === false) fail('storage', 'Cannot write ' . $file, 503); @chmod($file, 0600); } }
        finally { flock($lock, LOCK_UN); fclose($lock); }
    }
    // RESET_OWNER is deliberately edited outside the app. Shared hosts may
    // cache this tiny file even after it changes; read the current flags now.
    clearstatcache(true, $file);
    if (function_exists('opcache_invalidate')) @opcache_invalidate($file, true);
    require_once $file;
    if (!defined('APP_SECRET') || strlen(APP_SECRET) < 64) fail('configuration', 'APP_SECRET must contain at least 32 random bytes.', 503);
    return APP_SECRET;
}
function database(): PDO {
    static $db;
    if ($db) return $db;
    if (!extension_loaded('pdo_sqlite')) fail('requirements', 'Enable the PHP pdo_sqlite extension. No database server is required.', 503);
    $db = new PDO('sqlite:' . data_dir() . '/wavehaus.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    require_once __DIR__ . '/migrate.php';
    $migrations = is_dir(dirname(__DIR__) . '/migrations') ? dirname(__DIR__) . '/migrations' : dirname(__DIR__, 2) . '/migrations';
    migrate($db, data_dir(), $migrations);
    $version = (int)$db->query('SELECT COALESCE(MAX(version),0) FROM schema_migrations')->fetchColumn();
    if ($version > WH_SCHEMA) fail('schema_newer', 'This database needs a newer Wavehaus release. Restore the matching application files.', 503);
    @chmod(data_dir() . '/wavehaus.sqlite', 0600);
    return $db;
}
function transaction(PDO $db, callable $operation): mixed {
    // Tack's BEGIN IMMEDIATE pattern prevents stale recovery and setup reads.
    $db->exec('BEGIN IMMEDIATE');
    try { $result = $operation(); $db->exec('COMMIT'); return $result; }
    catch (Throwable $error) { $db->exec('ROLLBACK'); throw $error; }
}
function query_one(PDO $db, string $sql, array $params = []): array|false { $q = $db->prepare($sql); $q->execute($params); $row = $q->fetch(); $q->closeCursor(); return $row; }
function query_all(PDO $db, string $sql, array $params = []): array { $q = $db->prepare($sql); $q->execute($params); $rows = $q->fetchAll(); $q->closeCursor(); return $rows; }
function execute(PDO $db, string $sql, array $params = []): int { $q = $db->prepare($sql); $q->execute($params); $count = $q->rowCount(); $q->closeCursor(); return $count; }
