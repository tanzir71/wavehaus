<?php
declare(strict_types=1);
function ini_bytes(string $value): int {
    $value=trim($value);if($value===''||$value==='0'||$value==='-1')return PHP_INT_MAX;
    $factor=match(strtolower(substr($value,-1))){'g'=>1024**3,'m'=>1024**2,'k'=>1024,default=>1};return (int)$value*$factor;
}
function max_chunk_bytes(): int { return max(65536,min(8*1024**2,ini_bytes(ini_get('upload_max_filesize')),ini_bytes(ini_get('post_max_size'))-512*1024)); }
function route_request(PDO $db,string $path,string $method): never {
    if($path==='/api/health'&&$method==='GET')reply(['ok'=>true,'version'=>WH_VERSION,'schema'=>WH_SCHEMA,'backend'=>'php','needsSetup'=>!query_one($db,'SELECT id FROM users LIMIT 1')]);
    if($path==='/api/config'&&$method==='GET'){$cfg=settings($db);reply(['serverName'=>$cfg['server_name'],'registrationMode'=>$cfg['registration_mode'],'maxChunkBytes'=>max_chunk_bytes(),'maxFileBytes'=>$cfg['max_file_bytes'],'powDifficulty'=>$cfg['pow_difficulty'],'features'=>['demo'=>false,'uploads'=>true],'requirements'=>['php'=>PHP_VERSION,'pdoSqlite'=>extension_loaded('pdo_sqlite'),'fileinfo'=>extension_loaded('fileinfo'),'mbstring'=>extension_loaded('mbstring'),'openssl'=>extension_loaded('openssl')]]);}
    if(registration_routes($db,$path,$method))exit;
    if(auth_routes($db,$path,$method))exit;
    $auth=current_auth($db);
    if(read_api($db,$auth,$path,$method))exit;
    if(tokens_routes($db,$auth,$path,$method))exit;
    if(access_routes($db,$auth,$path,$method))exit;
    if(journal_routes($db,$auth,$path,$method))exit;
    if(metadata_routes($db,$auth,$path,$method))exit;
    if(visibility_routes($db,$auth,$path,$method))exit;
    if(playlists_routes($db,$auth,$path,$method))exit;
    if(uploads_routes($db,$auth,$path,$method)||artwork_routes($db,$auth,$path,$method)||library_routes($db,$auth,$path,$method)||playback_routes($db,$auth,$path,$method))exit;
    if($path==='/api/admin/settings'){
        require_admin($auth);
        if($method==='GET')reply(settings($db));
        if($method==='PATCH'){$input=body();if(isset($input['server_name'])&&(!is_string($input['server_name'])||mb_strlen($input['server_name'])>100||trim($input['server_name'])===''))fail('validation','Use a server name of 1–100 characters.');transaction($db,fn()=>save_settings($db,$input));reply(settings($db));}
    }
    fail('not_found','This endpoint is not available in this release.',404);
}
