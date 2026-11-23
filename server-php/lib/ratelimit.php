<?php
declare(strict_types=1);
function client_ip(array $settings): string {
    // Proxy addresses are trusted only when explicitly configured by the owner.
    if (($settings['trusted_proxy'] ?? '') === 'cloudflare' && isset($_SERVER['HTTP_CF_CONNECTING_IP'])) return $_SERVER['HTTP_CF_CONNECTING_IP'];
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}
function rate_limit(PDO $db, string $name, int $maximum, int $windowSeconds, string $identity): void {
    $key = hash_hmac('sha256', $name . ':' . $identity, app_secret()); $clock = now_ms(); $window = $windowSeconds * 1000;
    $state = transaction($db, function () use ($db, $key, $clock, $window) {
        $row = query_one($db, 'SELECT * FROM rate_limits WHERE key=?', [$key]);
        $active = $row && (int)$row['window_start'] + $window > $clock;
        $start = $active ? (int)$row['window_start'] : $clock; $count = $active ? (int)$row['count'] + 1 : 1;
        execute($db, 'INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=excluded.count', [$key,$start,$count]);
        return ['count'=>$count,'retry'=>max(1,(int)ceil(($start+$window-$clock)/1000))];
    });
    if ($state['count'] > $maximum) fail('rate_limited', 'Too many attempts. Try again in ' . (int)ceil($state['retry']/60) . ' minutes.', 429, $state['retry']);
}
