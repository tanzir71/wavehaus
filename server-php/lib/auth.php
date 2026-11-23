<?php
declare(strict_types=1);

// Ported from Tack's backend/index.php login/register/recover transactions and
// backend/bootstrap.php session/hash helpers. Wavehaus-specific adaptations:
// database-backed device sessions, ten one-use codes, __Host cookie, no email.
function password_algorithm(): string|int { return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT; }
function validate_username(mixed $input, bool $register = false): string {
    if (!is_string($input)) fail('validation', 'Enter a username and password.');
    $name = strtolower(trim($input));
    if (!preg_match('/^[a-z0-9_.-]{3,32}$/D', $name)) fail('validation', 'Use a username of 3–32 letters, numbers, dots, dashes, or underscores.');
    if ($register && in_array($name, ['admin','owner','root','api','setup','wavehaus','support','system'], true)) fail('validation', 'Choose another username. That name is reserved.');
    return $name;
}
function validate_password(mixed $password): string {
    if (!is_string($password) || mb_strlen($password, 'UTF-8') < 10 || strlen($password) > 72) fail('validation', 'Use a password or passphrase of at least 10 characters, up to 72 UTF-8 bytes.');
    return $password;
}
function device_label(mixed $label): string {
    if (!is_string($label) || trim($label) === '' || mb_strlen($label) > 100) fail('validation', 'Name this device before signing in.');
    return trim($label);
}
function public_user(array $row): array { return array_intersect_key($row, array_flip(['id','username','display_name','email','role','quota_bytes','used_bytes','invites_left','status','created_at','last_seen_at'])); }
function recovery_codes(PDO $db, string $userId): array {
    execute($db, 'DELETE FROM recovery_codes WHERE user_id=?', [$userId]); $codes = []; $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    for ($i = 0; $i < 10; $i++) {
        $code = ''; foreach (unpack('C*', random_bytes(10)) as $b) $code .= $alphabet[$b & 31];
        execute($db, 'INSERT INTO recovery_codes(id,user_id,code_hash) VALUES(?,?,?)', [ulid(),$userId,hash('sha256',$code)]);
        $codes[] = substr($code,0,4).'-'.substr($code,4,4).'-'.substr($code,8,2);
    }
    return $codes;
}
function recovery_hash(mixed $value): string {
    $normalized = strtr(strtoupper(preg_replace('/[\s-]/', '', is_string($value) ? $value : '')), ['O'=>'0','I'=>'1','L'=>'1']);
    return hash('sha256', $normalized);
}
function mint_session(PDO $db, string $userId, string $label): array {
    $raw = token(); $clock = now_ms(); $sid = ulid();
    execute($db, 'INSERT INTO sessions(id,user_id,token_hash,device_label,user_agent,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?)', [$sid,$userId,hash('sha256',$raw),$label,substr($_SERVER['HTTP_USER_AGENT'] ?? '',0,500),$clock,$clock,$clock+180*86400000]);
    return ['raw'=>$raw,'id'=>$sid,'device_label'=>$label];
}
function session_cookie(string $raw, bool $clear = false): void {
    setcookie('__Host-wh_session', $raw, ['expires'=>$clear?time()-3600:time()+180*86400,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
}
function current_auth(PDO $db, bool $required = true): ?array {
    static $cached = false;
    if ($cached !== false) { if ($required && $cached === null) fail('unauthenticated', 'Sign in to continue.', 401); return $cached; }
    $bearer=bearer_auth($db);if($bearer){$cached=$bearer;return $cached;}
    $raw = $_COOKIE['__Host-wh_session'] ?? '';
    $session = is_string($raw) && strlen($raw) < 256 ? query_one($db, 'SELECT * FROM sessions WHERE token_hash=? AND expires_at>?', [hash('sha256',$raw),now_ms()]) : false;
    $user = $session ? query_one($db, "SELECT * FROM users WHERE id=? AND status='active'", [$session['user_id']]) : false;
    if (!$user) { $cached = null; if ($required) fail('unauthenticated', 'Sign in to continue.', 401); return null; }
    $clock = now_ms();
    if ((int)$session['last_seen_at'] < $clock-600000) { execute($db,'UPDATE sessions SET last_seen_at=?,expires_at=? WHERE id=?',[$clock,$clock+180*86400000,$session['id']]); session_cookie($raw); }
    unset($session['token_hash']); $cached = ['user'=>public_user($user),'session'=>$session]; return $cached;
}
function require_admin(array $auth): void { if (!in_array($auth['user']['role'], ['owner','admin'], true)) fail('forbidden', 'Only an owner or admin can change server settings.', 403); }
function login_key(string $name, string $ip): string { return hash_hmac('sha256','login-fail:'.$name.':'.$ip,app_secret()); }
function check_login_lock(PDO $db, string $name, string $ip): void {
    $row = query_one($db,'SELECT locked_until FROM rate_limits WHERE key=?',[login_key($name,$ip)]);
    if ($row && (int)$row['locked_until'] > now_ms()) { $retry = (int)ceil(((int)$row['locked_until']-now_ms())/1000); fail('rate_limited','Too many attempts. Try again in '.(int)ceil($retry/60).' minutes.',429,$retry); }
}
function failed_login(PDO $db, string $name, string $ip): void {
    $key=login_key($name,$ip); $clock=now_ms();
    transaction($db, function()use($db,$key,$clock){
        $row=query_one($db,'SELECT * FROM rate_limits WHERE key=?',[$key]);$active=$row&&(int)$row['window_start']>$clock-900000;
        $count=$active?(int)$row['count']+1:1;$start=$active?(int)$row['window_start']:$clock;$until=null;
        if($count>=5){$strikeKey='strike:'.$key;$strike=query_one($db,'SELECT * FROM rate_limits WHERE key=?',[$strikeKey]);$strikes=$strike&&(int)$strike['window_start']>$clock-86400000?(int)$strike['count']:0;$until=$clock+min(86400000,900000*(2**min(7,$strikes)));execute($db,'INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=excluded.count',[$strikeKey,$clock,$strikes+1]);}
        execute($db,'INSERT INTO rate_limits(key,window_start,count,locked_until) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=excluded.count,locked_until=excluded.locked_until',[$key,$start,$count,$until]);
    });
}
function auth_routes(PDO $db, string $path, string $method): bool {
    if ($path==='/api/setup' && $method==='POST') {
        if (query_one($db,'SELECT id FROM users LIMIT 1')) fail('not_found','Not found.',404);
        $input=body();$name=validate_username($input['username']??null,true);$password=validate_password($input['password']??null);$server=trim((string)($input['serverName']??'Wavehaus'));
        if(!$server||mb_strlen($server)>100)fail('validation','Use a server name of 1–100 characters.');
        app_secret();$hash=password_hash($password,password_algorithm());$userId=ulid();$label=device_label($input['deviceLabel']??'Setup device');
        $result=transaction($db,function()use($db,$name,$hash,$server,$userId,$label){
            if(query_one($db,'SELECT id FROM users LIMIT 1'))fail('not_found','Not found.',404);
            execute($db,"INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,'owner',?)",[$userId,$name,$name,$hash,now_ms()]);
            save_settings($db,['server_name'=>$server]);$codes=recovery_codes($db,$userId);$session=mint_session($db,$userId,$label);
            return ['user'=>public_user(query_one($db,'SELECT * FROM users WHERE id=?',[$userId])),'recoveryCodes'=>$codes,'session'=>$session];
        });session_cookie($result['session']['raw']);unset($result['session']);reply($result,201);
    }
    if ($path==='/api/auth/login' && $method==='POST') {
        $input=body();$name=validate_username($input['username']??null);$password=(string)($input['password']??'');$label=device_label($input['deviceLabel']??null);$ip=client_ip(settings($db));
        rate_limit($db,'login-ip',30,900,$ip);check_login_lock($db,$name,$ip);
        $result=transaction($db,function()use($db,$name,$password,$label){
            $user=query_one($db,'SELECT * FROM users WHERE username=?',[$name]);
            if(!$user||$user['status']!=='active'||!password_verify($password,$user['password_hash']))return null;
            if(password_needs_rehash($user['password_hash'],password_algorithm()))execute($db,'UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,password_algorithm()),$user['id']]);
            return ['user'=>public_user($user),'session'=>mint_session($db,$user['id'],$label)];
        });
        if(!$result){failed_login($db,$name,$ip);fail('invalid_credentials','Username or password is incorrect.',401);}
        execute($db,'DELETE FROM rate_limits WHERE key IN (?,?)',[login_key($name,$ip),'strike:'.login_key($name,$ip)]);session_cookie($result['session']['raw']);reply(['user'=>$result['user']]);
    }
    if ($path==='/api/auth/recover' && $method==='POST') {
        $input=body();$name=validate_username($input['username']??null);$password=validate_password($input['newPassword']??null);rate_limit($db,'recover',5,900,client_ip(settings($db)).':'.$name);
        $result=transaction($db,function()use($db,$name,$password,$input){
            $user=query_one($db,'SELECT * FROM users WHERE username=?',[$name]);$code=$user?query_one($db,'SELECT id FROM recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL',[$user['id'],recovery_hash($input['recoveryCode']??'')]):false;
            if(!$code||$user['status']!=='active')fail('invalid_recovery','The recovery details are incorrect.',401);
            execute($db,'UPDATE recovery_codes SET used_at=? WHERE id=? AND used_at IS NULL',[now_ms(),$code['id']]);execute($db,'UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,password_algorithm()),$user['id']]);execute($db,'DELETE FROM sessions WHERE user_id=?',[$user['id']]);execute($db,'DELETE FROM pairing_codes WHERE user_id=?',[$user['id']]);
            return ['user'=>public_user($user),'session'=>mint_session($db,$user['id'],device_label($input['deviceLabel']??'Recovered device'))];
        });execute($db,'DELETE FROM rate_limits WHERE key IN (?,?)',[login_key($name,client_ip(settings($db))),'strike:'.login_key($name,client_ip(settings($db)))]);session_cookie($result['session']['raw']);reply(['user'=>$result['user']]);
    }
    if ($path==='/api/auth/me' && $method==='GET') {
        $auth=current_auth($db);$cfg=settings($db);$left=query_one($db,'SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id=? AND used_at IS NULL',[$auth['user']['id']]);
        reply([...$auth,'settings'=>array_intersect_key($cfg,array_flip(['server_name','registration_mode','default_visibility','members_can_upload','library_rules','upload_visibility_locked'])),'recoveryCodesLeft'=>(int)$left['n']]);
    }
    if ($path==='/api/auth/logout' && $method==='POST') { $auth=current_auth($db);execute($db,'DELETE FROM sessions WHERE id=?',[$auth['session']['id']]);session_cookie('',true);reply(['ok'=>true]); }
    if ($path==='/api/sessions' && $method==='GET') { $auth=current_auth($db);$rows=query_all($db,'SELECT id,device_label,user_agent,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen_at DESC',[$auth['user']['id'],now_ms()]);foreach($rows as &$row)$row['current']=$row['id']===$auth['session']['id'];reply(['items'=>$rows,'nextCursor'=>null]); }
    if (preg_match('~^/api/sessions/([^/]+)$~',$path,$match) && $method==='DELETE') { $auth=current_auth($db);execute($db,'DELETE FROM sessions WHERE id=? AND user_id=?',[$match[1],$auth['user']['id']]);if($match[1]===$auth['session']['id'])session_cookie('',true);reply(['ok'=>true]); }
    if ($path==='/api/auth/sessions/revoke-others' && $method==='POST') { $auth=current_auth($db);execute($db,'DELETE FROM sessions WHERE user_id=? AND id<>?',[$auth['user']['id'],$auth['session']['id']]);reply(['ok'=>true]); }
    if ($path==='/api/auth/recovery-codes' && $method==='POST') { $auth=current_auth($db);rate_limit($db,'sensitive-auth',5,900,$auth['user']['id'].':'.client_ip(settings($db)));$input=body();$codes=transaction($db,function()use($db,$auth,$input){$user=query_one($db,'SELECT password_hash FROM users WHERE id=?',[$auth['user']['id']]);if(!password_verify((string)($input['password']??''),$user['password_hash']))fail('invalid_credentials','Username or password is incorrect.',401);return recovery_codes($db,$auth['user']['id']);});reply(['recoveryCodes'=>$codes]); }
    if ($path==='/api/auth/password' && $method==='POST') { $auth=current_auth($db);rate_limit($db,'sensitive-auth',5,900,$auth['user']['id'].':'.client_ip(settings($db)));$input=body();$new=validate_password($input['newPassword']??null);transaction($db,function()use($db,$auth,$input,$new){$user=query_one($db,'SELECT password_hash FROM users WHERE id=?',[$auth['user']['id']]);if(!password_verify((string)($input['password']??''),$user['password_hash']))fail('invalid_credentials','Username or password is incorrect.',401);execute($db,'UPDATE users SET password_hash=? WHERE id=?',[password_hash($new,password_algorithm()),$auth['user']['id']]);execute($db,'DELETE FROM sessions WHERE user_id=? AND id<>?',[$auth['user']['id'],$auth['session']['id']]);execute($db,'DELETE FROM pairing_codes WHERE user_id=?',[$auth['user']['id']]);});reply(['ok'=>true]); }
    if ($path==='/api/auth/pair' && $method==='POST') {
        $auth=current_auth($db);rate_limit($db,'pair-create',10,900,$auth['user']['id']);$secret=token(16);$expires=now_ms()+300000;
        $code=transaction($db,function()use($db,$auth,$secret,$expires){for($try=0;$try<10;$try++){$code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);$hash=hash('sha256',$code);if(query_one($db,'SELECT id FROM pairing_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>?',[$hash,now_ms()]))continue;execute($db,'INSERT INTO pairing_codes(id,user_id,code_hash,secret_hash,expires_at) VALUES(?,?,?,?,?)',[ulid(),$auth['user']['id'],$hash,hash('sha256',$secret),$expires]);return $code;}fail('busy','Please try creating a code again.',503);});
        $host=$_SERVER['HTTP_HOST'];$scheme=getenv('WAVEHAUS_DEV')==='1'?'http':'https';reply(['code'=>$code,'qrUrl'=>$scheme.'://'.$host.app_base().'pair#'.$secret,'expiresAt'=>$expires]);
    }
    if ($path==='/api/auth/pair/claim' && $method==='POST') {
        $input=body();rate_limit($db,'pair-claim',10,900,client_ip(settings($db)));$label=device_label($input['deviceLabel']??null);$secret=isset($input['secret']);$raw=(string)($secret?$input['secret']:($input['code']??''));
        if(($secret&&!preg_match('/^[A-Za-z0-9_-]{22}$/D',$raw))||(!$secret&&!preg_match('/^\d{6}$/D',$raw)))fail('invalid_pair','That pairing code is unavailable or expired.',401);
        if(!$secret)rate_limit($db,'pair-code',5,300,hash('sha256',$raw));
        $result=transaction($db,function()use($db,$raw,$secret,$label){$column=$secret?'secret_hash':'code_hash';$pair=query_one($db,"SELECT p.* FROM pairing_codes p JOIN users u ON u.id=p.user_id WHERE p.$column=? AND p.used_at IS NULL AND p.expires_at>? AND p.attempts<5 AND u.status='active' ORDER BY p.expires_at DESC LIMIT 1",[hash('sha256',$raw),now_ms()]);if(!$pair)return null;execute($db,'UPDATE pairing_codes SET used_at=? WHERE id=? AND used_at IS NULL',[now_ms(),$pair['id']]);return ['user'=>public_user(query_one($db,'SELECT * FROM users WHERE id=?',[$pair['user_id']])),'session'=>mint_session($db,$pair['user_id'],$label)];});
        if(!$result)fail('invalid_pair','That pairing code is unavailable or expired.',401);session_cookie($result['session']['raw']);reply(['user'=>$result['user']]);
    }
    if ($path==='/api/setup/reset' && $method==='POST') {
        app_secret();if(!defined('RESET_OWNER'))fail('not_found','Not found.',404);$input=body();rate_limit($db,'owner-reset',5,900,client_ip(settings($db)));if(!hash_equals((string)RESET_OWNER,(string)($input['resetString']??'')))fail('invalid_recovery','The recovery details are incorrect.',401);$password=validate_password($input['newPassword']??null);
        $result=transaction($db,function()use($db,$password){$usedKey=hash('sha256','owner-reset:'.RESET_OWNER);if(query_one($db,'SELECT key FROM rate_limits WHERE key=?',[$usedKey]))fail('not_found','Use a new RESET_OWNER string for another reset.',404);execute($db,'INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,1)',[$usedKey,now_ms()]);$owner=query_one($db,"SELECT id FROM users WHERE role='owner'");if(!$owner)fail('not_found','Not found.',404);execute($db,'UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,password_algorithm()),$owner['id']]);execute($db,'DELETE FROM sessions WHERE user_id=?',[$owner['id']]);execute($db,'DELETE FROM pairing_codes WHERE user_id=?',[$owner['id']]);$codes=recovery_codes($db,$owner['id']);return ['recoveryCodes'=>$codes,'session'=>mint_session($db,$owner['id'],'Owner reset')];});
        $config=data_dir().'/config.php';$removed=preg_replace('/^.*define\s*\(\s*[\'\"]RESET_OWNER[\'\"].*;\s*$/m','',file_get_contents($config));$needsRemoval=file_put_contents($config,$removed,LOCK_EX)===false;session_cookie($result['session']['raw']);reply(['recoveryCodes'=>$result['recoveryCodes'],'removeResetFlag'=>$needsRemoval]);
    }
    return false;
}
