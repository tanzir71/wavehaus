<?php
declare(strict_types=1);
function playback_integer(mixed $value,string $label,int $max,int $min=0): int {
    if(!is_int($value)&&!is_float($value)||!is_finite((float)$value)||floor((float)$value)!==(float)$value||$value<$min||$value>$max)fail('validation',$label.' is invalid.');return (int)$value;
}
function playback_boolean(array $input,string $key,bool $default=false): bool { if(!array_key_exists($key,$input))return $default;if(!is_bool($input[$key]))fail('validation',$key.' must be on or off.');return $input[$key]; }
function playback_ids(mixed $value,string $label,int $max=2000): array { if(!is_array($value)||!array_is_list($value)||count($value)>$max)fail('validation',$label.' must contain up to '.$max.' track IDs.');foreach($value as $id)if(!is_string($id)||!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$id))fail('validation','Invalid track ID in '.$label.'.');return $value; }
function playback_source(mixed $value): string { if(!in_array($value,['context','queue','autoplay'],true))fail('validation','Invalid queue source.');return $value; }
function player_input(array $input): array {
    $queue=playback_ids($input['queue']??null,'Queue');$repeat=$input['repeat']??null;if(!in_array($repeat,['off','all','one'],true))fail('validation','Choose a repeat mode.');
    $result=['queue'=>$queue,'index'=>playback_integer($input['index']??null,'Queue position',max(0,count($queue)-1)),'positionMs'=>playback_integer($input['positionMs']??null,'Playback position',7*86400000),'updatedAt'=>playback_integer($input['updatedAt']??null,'Playback timestamp',9007199254740991),'shuffle'=>playback_boolean($input,'shuffle'),'repeat'=>$repeat,'autoplay'=>playback_boolean($input,'autoplay',true)];
    if(array_key_exists('sections',$input)){
        $s=$input['sections'];if(!is_array($s)||array_is_list($s))fail('validation','Invalid saved queue.');$context=playback_ids($s['context']??null,'Context');$remaining=playback_ids($s['remaining']??null,'Remaining context');$manual=playback_ids($s['manual']??null,'User queue');$automatic=playback_ids($s['automatic']??null,'Autoplay',100);
        if(count($context)+count($manual)+count($automatic)>4000)fail('validation','This queue is too large to save.');$current=$s['current']??null;if($current!==null)playback_ids([$current],'Current track',1);
        $history=$s['history']??null;if(!is_array($history)||!array_is_list($history)||count($history)>100)fail('validation','Invalid queue history.');$savedHistory=[];foreach($history as $entry){if(!is_array($entry))fail('validation','Invalid queue history.');playback_ids([$entry['id']??null],'History track',1);$savedHistory[]=['id'=>$entry['id'],'source'=>playback_source($entry['source']??null)];}
        $result['sections']=['context'=>$context,'remaining'=>$remaining,'manual'=>$manual,'automatic'=>$automatic,'history'=>$savedHistory,'current'=>$current,'currentSource'=>playback_source($s['currentSource']??null),'contextLabel'=>input_text($s['contextLabel']??null,'Context name',200)??'Your library','contextType'=>input_text($s['contextType']??null,'Playback context',512)??'library','shuffle'=>$result['shuffle'],'repeat'=>$repeat,'autoplay'=>$result['autoplay']];
    }
    return $result;
}
function plays_input(array $input): array {
    $plays=$input['plays']??null;if(!is_array($plays)||!array_is_list($plays)||count($plays)>100)fail('validation','Send up to 100 plays at a time.');$result=[];
    foreach($plays as $p){if(!is_array($p))fail('validation','Invalid play.');playback_ids([$p['trackId']??null],'Played track',1);if(isset($p['id']))playback_ids([$p['id']],'Play ID',1);$completed=playback_boolean($p,'completed');$skipped=playback_boolean($p,'skipped');if($completed&&$skipped)fail('validation','A completed play cannot also be skipped.');$result[]=['id'=>$p['id']??ulid(),'trackId'=>$p['trackId'],'startedAt'=>playback_integer($p['startedAt']??null,'Play timestamp',now_ms()+300000),'msPlayed'=>playback_integer($p['msPlayed']??null,'Listening time',7*86400000),'completed'=>$completed,'skipped'=>$skipped,'context'=>input_text($p['context']??null,'Playback context',512),'deviceLabel'=>input_text($p['deviceLabel']??null,'Device name',100)];}
    return $result;
}
function playback_cursor(?string $raw): array {
    if($raw===null)return [PHP_INT_MAX,'ZZZZZZZZZZZZZZZZZZZZZZZZZZ'];
    $parts=explode('.',$raw);if(count($parts)!==2||!ctype_digit($parts[0])||!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$parts[1]))fail('validation','Invalid play history cursor.');return [playback_integer((float)$parts[0],'History timestamp',9007199254740991),$parts[1]];
}
function playback_routes(PDO $db,array $auth,string $path,string $method): bool {
    $uid=$auth['user']['id'];
    if($path==='/api/player-state'){
        if($method==='GET'){$row=query_one($db,'SELECT state FROM player_state WHERE user_id=?',[$uid]);reply($row?json_decode($row['state'],true):null);}
        if($method==='PUT'){$value=player_input(body());execute($db,'INSERT INTO player_state(user_id,state,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at',[$uid,json_encode($value,JSON_THROW_ON_ERROR),now_ms()]);reply($value);}
    }
    if($path!=='/api/plays')return false;
    if($method==='POST'){
        $plays=plays_input(body());$recorded=transaction($db,function()use($db,$uid,$plays){$count=0;foreach($plays as $p)$count+=execute($db,"INSERT OR IGNORE INTO plays(id,user_id,track_id,started_at,ms_played,completed,skipped,context,device_label) SELECT ?,?,?,?,?,?,?,?,? FROM tracks WHERE id=? AND deleted=0 AND (owner_id=? OR visibility='public')",[$p['id'],$uid,$p['trackId'],$p['startedAt'],$p['msPlayed'],$p['completed']?1:0,$p['skipped']?1:0,$p['context'],$p['deviceLabel'],$p['trackId'],$uid]);return $count;});reply(['ok'=>true,'recorded'=>$recorded]);
    }
    if($method==='GET'){
        $limit=filter_var($_GET['limit']??'100',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>500]]);if($limit===false)fail('validation','Use a history page size from 1 to 500.');[$at,$id]=playback_cursor($_GET['cursor']??null);
        $rows=query_all($db,'SELECT * FROM plays WHERE user_id=? AND (started_at<? OR (started_at=? AND id<?)) ORDER BY started_at DESC,id DESC LIMIT '.($limit+1),[$uid,$at,$at,$id]);$more=count($rows)>$limit;$items=array_slice($rows,0,$limit);$last=$items?end($items):null;reply(['items'=>$items,'nextCursor'=>$more?$last['started_at'].'.'.$last['id']:null]);
    }
    return false;
}
