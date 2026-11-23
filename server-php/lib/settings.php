<?php
declare(strict_types=1);
function settings(PDO $db): array {
    $result = [];
    foreach (query_all($db, 'SELECT key,value FROM settings') as $row) $result[$row['key']] = json_decode($row['value'], true);
    return $result;
}
function save_settings(PDO $db, array $values): void {
    $allowed = ['server_name','registration_mode','default_role','members_can_upload','default_visibility','member_quota_bytes','invites_per_member','referrals_need_approval','pow_difficulty','max_file_bytes','trusted_proxy','library_rules'];
    foreach ($values as $key => $value) {
        if (!in_array($key, $allowed, true)) fail('invalid_setting', 'Unknown setting: ' . $key);
        if ($key === 'registration_mode' && !in_array($value, ['closed','invite','request','open'], true)) fail('invalid_setting', 'Choose a registration mode.');
        if ($key === 'default_visibility' && $value !== 'private') fail('invalid_setting', 'New uploads are private by default.');
        if($key==='library_rules'){if(!is_array($value)||count($value)&&array_is_list($value))fail('validation','Library rules must be an object.');foreach($value as $rule=>$flag)if(!in_array($rule,['tags','folders','filenames','stripJunk','titleCase','groupAlbums','variousArtists','mergeExisting','numberTracks','recordings'],true)||!is_bool($flag))fail('validation','Use known library rules with true or false.');}
        execute($db, 'INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', [$key, json_encode($value, JSON_THROW_ON_ERROR), now_ms()]);
    }
}
