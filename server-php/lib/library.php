<?php
declare(strict_types=1);
function next_rev(PDO $db): int { execute($db,'UPDATE revs SET n=n+1 WHERE id=1');return (int)query_one($db,'SELECT n FROM revs WHERE id=1')['n']; }
function album_row(PDO $db,string $id): array|false { return query_one($db,'SELECT a.*,COALESCE(a.artist_name,ar.name) AS artist_name FROM albums a LEFT JOIN artists ar ON ar.id=a.artist_id WHERE a.id=?',[$id]); }
function track_row(PDO $db,string $id): array|false { return query_one($db,'SELECT * FROM tracks WHERE id=?',[$id]); }
function readable_track(PDO $db,array $auth,string $id): array {
    $track=query_one($db,'SELECT * FROM tracks WHERE id=? AND deleted=0',[$id]);if(!$track)fail('not_found','Track not found.',404);
    if($track['owner_id']!==$auth['user']['id']&&$track['visibility']!=='public')fail('forbidden','This track is private.',403);return $track;
}
function log_change(PDO $db,array $auth,string $summary,array $ops): string {
    $id=ulid();execute($db,'INSERT INTO changes(id,user_id,actor,session_label,summary,ops,created_at) VALUES(?,?,?,?,?,?,?)',[$id,$auth['user']['id'],'web',$auth['session']['device_label'],$summary,json_encode($ops,JSON_THROW_ON_ERROR),now_ms()]);return $id;
}
function ensure_artist(PDO $db,string $name,string $album): array {
    $key=normalized_name($name);$artist=query_one($db,'SELECT * FROM artists WHERE name_key=? AND deleted=0',[$key]);if($artist){$artist['rev']=next_rev($db);execute($db,'UPDATE artists SET rev=? WHERE id=?',[$artist['rev'],$artist['id']]);return $artist;}
    $id=ulid();execute($db,'INSERT INTO artists(id,name,sort_name,tint,rev,name_key) VALUES(?,?,?,?,?,?)',[$id,$name,$name,cover_tint($name,$album),next_rev($db),$key]);return query_one($db,'SELECT * FROM artists WHERE id=?',[$id]);
}
function library_routes(PDO $db,array $auth,string $path,string $method): bool {
    $userId=$auth['user']['id'];
    if($path==='/api/library'&&$method==='GET'){
        $since=filter_var($_GET['since']??'0',FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);if($since===false)fail('invalid_cursor','Invalid library cursor.');
        $limit=filter_var($_GET['limit']??'2000',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>2000]]);if($limit===false)fail('validation','Use a library page size from 1 to 2000.');
        $revision=(int)query_one($db,'SELECT n FROM revs WHERE id=1')['n'];$rows=[];$items=['tracks'=>[],'albums'=>[],'artists'=>[],'playlists'=>[],'playlistItems'=>[],'likes'=>[],'moments'=>[]];
        // Bound each query at the request's revision. An update during a sync
        // gets a later revision and is picked up on the next page/poll.
        $queries=[
            'tracks'=>['SELECT t.* FROM tracks t WHERE t.rev>? AND t.rev<=? AND (t.owner_id=? OR t.visibility=\'public\') ORDER BY t.rev',[$since,$revision,$userId]],
            'albums'=>['SELECT a.*,COALESCE(a.artist_name,ar.name) AS artist_name FROM albums a LEFT JOIN artists ar ON ar.id=a.artist_id WHERE a.rev>? AND a.rev<=? AND (a.owner_id=? OR a.visibility=\'public\') ORDER BY a.rev',[$since,$revision,$userId]],
            'artists'=>['SELECT ar.* FROM artists ar WHERE ar.rev>? AND ar.rev<=? AND (EXISTS(SELECT 1 FROM tracks t WHERE t.artist_id=ar.id AND (t.owner_id=? OR t.visibility=\'public\')) OR EXISTS(SELECT 1 FROM albums a WHERE a.artist_id=ar.id AND (a.owner_id=? OR a.visibility=\'public\'))) ORDER BY ar.rev',[$since,$revision,$userId,$userId]],
            'playlists'=>['SELECT p.* FROM playlists p WHERE p.rev>? AND p.rev<=? AND (p.owner_id=? OR p.visibility=\'public\') ORDER BY p.rev',[$since,$revision,$userId]],
            'playlistItems'=>['SELECT i.* FROM playlist_items i JOIN playlists p ON p.id=i.playlist_id JOIN tracks t ON t.id=i.track_id WHERE i.rev>? AND i.rev<=? AND (p.owner_id=? OR p.visibility=\'public\') AND (t.owner_id=? OR t.visibility=\'public\') ORDER BY i.rev',[$since,$revision,$userId,$userId]],
            'likes'=>['SELECT l.* FROM likes l JOIN tracks t ON t.id=l.track_id WHERE l.rev>? AND l.rev<=? AND l.user_id=? AND (t.owner_id=? OR t.visibility=\'public\') ORDER BY l.rev',[$since,$revision,$userId,$userId]],
            'moments'=>['SELECT m.* FROM moments m JOIN tracks t ON t.id=m.track_id WHERE m.rev>? AND m.rev<=? AND m.user_id=? AND (t.owner_id=? OR t.visibility=\'public\') ORDER BY m.rev',[$since,$revision,$userId,$userId]]
        ];
        $hidden=['tracks'=>[],'albums'=>[],'playlists'=>[]];foreach(array_keys($hidden)as $table)$queries['hidden:'.$table]=['SELECT id,hidden_rev AS rev FROM '.$table.' WHERE hidden_rev>? AND hidden_rev<=? AND visibility=\'private\' AND owner_id<>? ORDER BY hidden_rev',[$since,$revision,$userId]];
        $cutoff=PHP_INT_MAX;
        foreach($queries as $key=>[$sql,$parameters]){
            $query=$db->prepare($sql.' LIMIT '.($limit+1));$query->execute($parameters);$collectionBytes=0;
            while($row=$query->fetch()){$collectionBytes+=strlen(json_encode($row,JSON_THROW_ON_ERROR));if($collectionBytes>8*1024**2){$cutoff=min($cutoff,(int)$row['rev']);break;}$rows[]=['key'=>$key,'row'=>$row];}
            $query->closeCursor();
        }
        $rows=array_values(array_filter($rows,fn($entry)=>(int)$entry['row']['rev']<$cutoff));
        usort($rows,fn($a,$b)=>(int)$a['row']['rev']<=>(int)$b['row']['rev']);$page=[];$bytes=0;
        foreach($rows as $entry){$bytes+=strlen(json_encode($entry['row'],JSON_THROW_ON_ERROR));if(count($page)>=$limit||$bytes>8*1024**2&&count($page))break;$page[]=$entry;}
        foreach($page as $entry){if(str_starts_with($entry['key'],'hidden:'))$hidden[substr($entry['key'],7)][]=$entry['row']['id'];else $items[$entry['key']][]=$entry['row'];}$more=count($page)<count($rows)||$cutoff!==PHP_INT_MAX;$cursor=$more?(int)$page[count($page)-1]['row']['rev']:$revision;
        reply(['rev'=>$cursor,'items'=>$items,'hidden'=>$hidden,'more'=>$more]);
    }
    if(preg_match('~^/api/tracks/([0-9A-HJKMNP-TV-Z]{26})/peaks$~',$path,$match)&&$method==='POST'){
        $track=readable_track($db,$auth,$match[1]);$peaks=input_peaks(body()['peaks']??null);if($peaks===null)fail('invalid_peaks','Waveforms need exactly 1000 peak values.');
        transaction($db,function()use($db,$track,$peaks){execute($db,'UPDATE tracks SET peaks=?,updated_at=?,rev=? WHERE id=? AND peaks IS NULL',[$peaks,now_ms(),next_rev($db),$track['id']]);});reply(['ok'=>true]);
    }
    if(preg_match('~^/api/likes/([0-9A-HJKMNP-TV-Z]{26})$~',$path,$match)&&in_array($method,['PUT','DELETE'],true)){
        $track=readable_track($db,$auth,$match[1]);transaction($db,function()use($db,$track,$userId,$method){execute($db,'INSERT INTO likes(user_id,track_id,liked_at,rev,deleted) VALUES(?,?,?,?,?) ON CONFLICT(user_id,track_id) DO UPDATE SET liked_at=excluded.liked_at,rev=excluded.rev,deleted=excluded.deleted',[$userId,$track['id'],now_ms(),next_rev($db),$method==='DELETE'?1:0]);});reply(['ok'=>true]);
    }
    if($path==='/api/changes'&&$method==='GET'){
        $limit=filter_var($_GET['limit']??'50',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>100]]);if($limit===false)fail('validation','Use an activity page size from 1 to 100.');
        $cursor=filter_var($_GET['cursor']??(string)PHP_INT_MAX,FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);if($cursor===false)fail('validation','Invalid activity cursor.');
        $rows=query_all($db,'SELECT * FROM changes WHERE user_id=? AND created_at<? ORDER BY created_at DESC LIMIT '.($limit+1),[$userId,$cursor]);$more=count($rows)>$limit;$rows=array_slice($rows,0,$limit);foreach($rows as &$row)$row['ops']=json_decode($row['ops'],true);
        reply(['items'=>$rows,'nextCursor'=>$more?(string)$rows[count($rows)-1]['created_at']:null]);
    }
    return false;
}
