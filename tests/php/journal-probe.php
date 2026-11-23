<?php
declare(strict_types=1);
// Disposable loopback integration entry point. Never shipped in an archive.
$root=dirname(__DIR__,2);require $root.'/server-php/lib/bootstrap.php';require $root.'/server-php/lib/migrate.php';require $root.'/server-php/lib/library.php';require $root.'/server-php/lib/journal.php';require $root.'/server-php/lib/upload-input.php';require $root.'/server-php/lib/metadata.php';
require $root.'/server-php/lib/art.php';
$path=getenv('JOURNAL_TEST_DATABASE');if(!$path)throw new RuntimeException('A disposable test database is required.');
$db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$db->exec('PRAGMA foreign_keys=ON');$db->exec('PRAGMA busy_timeout=5000');
if(PHP_SAPI==='cli'){migrate($db,dirname($path),$root.'/migrations');$db->exec(file_get_contents($argv[1]));exit;}
function probe_state(PDO $db): array {return [
    'tracks'=>query_all($db,'SELECT id,owner_id,album_id,artist_id,title,artist_name,album_artist,album_title,year,genre,track_no,disc_no,visibility,hidden_rev,rev,deleted FROM tracks ORDER BY id'),
    'albums'=>query_all($db,'SELECT id,owner_id,title,artist_name,visibility,sync_visibility,art_key,art_source,rev,deleted FROM albums ORDER BY id'),
    'changes'=>query_all($db,'SELECT id,summary,undoable,undone_at FROM changes ORDER BY created_at,id'),
    'guardCount'=>(int)query_one($db,'SELECT COUNT(*) AS n FROM mutation_guards')['n'],
    'operationCount'=>(int)query_one($db,'SELECT COUNT(*) AS n FROM change_ops')['n'],
    'revision'=>(int)query_one($db,'SELECT n FROM revs WHERE id=1')['n']
];}
try{
    $route=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);if($route==='/_ready')reply(['ok'=>true]);if($route==='/state')reply(probe_state($db));
    $input=$_SERVER['REQUEST_METHOD']==='GET'||!str_contains($_SERVER['CONTENT_TYPE']??'','application/json')?[]:body();$owner='01J'.str_repeat('0',19).'9000';$user=query_one($db,'SELECT * FROM users WHERE id=?',[$input['actor']??$_GET['actor']??$owner]);if(!$user)reply([],401);$auth=['user'=>$user,'session'=>['device_label'=>'Journal integration']];
    if(str_starts_with($route,'/api/changes')){journal_routes($db,$auth,$route,$_SERVER['REQUEST_METHOD']);reply([],404);}
    if($route==='/api/tracks'){metadata_routes($db,$auth,$route,$_SERVER['REQUEST_METHOD']);reply([],404);}
    if($route==='/api/library'){library_routes($db,$auth,$route,$_SERVER['REQUEST_METHOD']);reply([],404);}
    if(str_contains($route,'/art')){artwork_routes($db,$auth,$route,$_SERVER['REQUEST_METHOD']);reply([],404);}
    if($route==='/same-time'){execute($db,'UPDATE changes SET created_at=?',[now_ms()]);reply(['ok'=>true]);}
    if($route==='/apply')reply(journal_write($db,$auth,$input));
    if($route==='/legacy'){
        execute($db,'UPDATE tracks SET lyrics=?,peaks=? WHERE id=?',[str_repeat("Line\n",30000),base64_encode(str_repeat("\0",1000)),$input['rowId']]);$before=query_one($db,'SELECT * FROM tracks WHERE id=?',[$input['rowId']]);if(!$before)throw new RuntimeException('Missing fixture row.');
        transaction($db,function()use($db,$input,$before){execute($db,'UPDATE tracks SET title=?,rev=? WHERE id=?',[$input['mode']==='metadata'?'Legacy after':$before['title'],next_rev($db),$input['rowId']]);});$after=query_one($db,'SELECT * FROM tracks WHERE id=?',[$input['rowId']]);
        $id=log_change($db,$auth,'Legacy operation',[['table'=>'tracks','id'=>$input['rowId'],'before'=>$input['mode']==='metadata'?$before:null,'after'=>$after]]);$changes=journal_read_changes($db,$auth,[$id]);$rows=journal_read_rows($db,array_merge(...array_column($changes,'ops')));reply(['changeId'=>$id,'loadedFields'=>array_map('array_keys',array_values($rows)),'snapshots'=>$changes[0]['ops']]);
    }
    reply([],404);
}catch(ApiException $error){reply(['error'=>['code'=>$error->errorCode,'message'=>$error->getMessage(),...($error->conflicts!==null?['conflicts'=>$error->conflicts]:[])]],$error->getCode());}
catch(Throwable $error){reply(['error'=>['code'=>'internal','message'=>$error->getMessage()]],500);}
