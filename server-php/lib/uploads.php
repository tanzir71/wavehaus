<?php
declare(strict_types=1);
function require_upload(array $auth,array $cfg): void {
    $role=$auth['user']['role'];if(!in_array($role,['owner','admin'],true)&&!($role==='uploader'&&($cfg['members_can_upload']??false)===true))fail('forbidden','Your account cannot upload music.',403);
}
function upload_record(PDO $db,array $auth,string $id): array {
    if(!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$id))fail('not_found','Upload not found.',404);
    $upload=query_one($db,'SELECT * FROM uploads WHERE id=? AND user_id=?',[$id,$auth['user']['id']]);if(!$upload)fail('not_found','Upload not found.',404);return $upload;
}
function upload_directory(string $id): string {
    if(!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$id))fail('not_found','Upload not found.',404);
    $path=data_dir().'/tmp/'.$id;if(!is_dir($path)&&!mkdir($path,0700,true))fail('storage','Cannot create the upload directory.',503);return $path;
}
function upload_lock(string $id,callable $operation): mixed {
    $lock=fopen(upload_directory($id).'/upload.lock','c');if(!$lock||!flock($lock,LOCK_EX))fail('storage','Cannot lock this upload.',503);
    try{return $operation();}finally{flock($lock,LOCK_UN);fclose($lock);}
}
function upload_parts(PDO $db,string $id): array { return query_all($db,'SELECT part_no,size_bytes,sha256 FROM upload_parts WHERE upload_id=? ORDER BY part_no',[$id]); }
function upload_result(PDO $db,array $upload): array { return ['uploadId'=>$upload['id'],'chunkBytes'=>(int)$upload['chunk_bytes'],'partsReceived'=>array_column(upload_parts($db,$upload['id']),'part_no'),'status'=>$upload['status'],'trackId'=>$upload['completed_track_id']]; }
function quota_left(PDO $db,string $id): ?int {
    $user=query_one($db,'SELECT quota_bytes,used_bytes FROM users WHERE id=?',[$id]);return $user['quota_bytes']===null?null:max(0,(int)$user['quota_bytes']-(int)$user['used_bytes']);
}
function charge_upload_rate(PDO $db,array $auth,int $size): void {
    if($auth['user']['role']==='owner')return;
    $key=hash_hmac('sha256','upload-bytes:'.$auth['user']['id'],app_secret());$clock=now_ms();$row=query_one($db,'SELECT * FROM rate_limits WHERE key=?',[$key]);
    $active=$row&&(int)$row['window_start']>$clock-3600000;$start=$active?(int)$row['window_start']:$clock;$count=($active?(int)$row['count']:0)+$size;
    if($count>5*1024**3)fail('rate_limited','Upload limit reached. Try again in '.(int)ceil(($start+3600000-$clock)/60000).' minutes.',429,max(1,(int)ceil(($start+3600000-$clock)/1000)));
    execute($db,'INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=excluded.count',[$key,$start,$count]);
}
function quick_file_hash(string $path,int $size): string {
    $file=fopen($path,'rb');if(!$file)fail('storage','Cannot verify the uploaded file.',503);$hash=hash_init('sha256');
    try{hash_update($hash,fread($file,min(1024**2,$size)));fseek($file,max(0,$size-1024**2));hash_update($hash,fread($file,min(1024**2,$size)));hash_update($hash,(string)$size);return hash_final($hash);}finally{fclose($file);}
}
function clear_upload_parts(PDO $db,string $id): void {
    $directory=upload_directory($id);
    foreach(glob($directory.'/*')?:[]as $path)if(preg_match('/^(?:[0-9]+\.part|assembled)$/D',basename($path))&&is_file($path))unlink($path);
    execute($db,'DELETE FROM upload_parts WHERE upload_id=?',[$id]);
}
function complete_upload(PDO $db,array $auth,string $id,array $input): array {
    return upload_lock($id,function()use($db,$auth,$id,$input){
        $upload=upload_record($db,$auth,$id);
        if($upload['status']==='complete'&&$upload['completed_track_id']){
            $track=track_row($db,$upload['completed_track_id']);if(!$track||$track['deleted'])fail('upload_closed','This completed track is no longer in the library.',409);
            return ['track'=>$track,'album'=>album_row($db,$track['album_id']),'changeId'=>$upload['completed_change_id']];
        }
        if($upload['status']!=='open'||(int)$upload['expires_at']<now_ms())fail('upload_closed','This upload is no longer open.',409);
        $count=(int)ceil((int)$upload['size_bytes']/(int)$upload['chunk_bytes']);$parts=upload_parts($db,$id);
        if(count($parts)!==$count)fail('incomplete','Some upload parts are missing.',409);
        $directory=upload_directory($id);$assembled=$directory.'/assembled';$out=fopen($assembled,'wb');if(!$out)fail('storage','Cannot assemble the uploaded file.',503);
        try{
            for($n=1;$n<=$count;$n++){
                $part=$parts[$n-1];$expected=min((int)$upload['chunk_bytes'],(int)$upload['size_bytes']-($n-1)*(int)$upload['chunk_bytes']);$path=$directory.'/'.$n.'.part';
                if((int)$part['part_no']!==$n||!is_file($path)||filesize($path)!==$expected)fail('incomplete','An upload part is missing.',409);
                $in=fopen($path,'rb');if(!$in)fail('storage','Cannot read an upload part.',503);try{if(stream_copy_to_stream($in,$out)!==$expected)fail('storage','Could not assemble the whole file.',503);}finally{fclose($in);}
            }
        }finally{fclose($out);}
        if(filesize($assembled)!==(int)$upload['size_bytes']||!hash_equals($upload['sha256'],hash_file('sha256',$assembled)))fail('hash_mismatch','The uploaded file failed its integrity check.',409);
        $handle=fopen($assembled,'rb');try{$mime=sniff_audio(fread($handle,32),$upload['filename']);}finally{fclose($handle);}
        $quick=quick_file_hash($assembled,(int)$upload['size_bytes']);$m=$input['metadata'];$a=$input['album'];
        if($m['quickHash']&&!hash_equals($quick,$m['quickHash']))fail('hash_mismatch','The quick hash does not match the uploaded file.',409);
        $key='media/'.$auth['user']['id'].'/'.$upload['sha256'];$destination=data_dir().'/'.$key;
        if(!is_dir(dirname($destination))&&!mkdir(dirname($destination),0700,true))fail('storage','Cannot create the media directory.',503);
        $result=transaction($db,function()use($db,$auth,$upload,$input,$m,$a,$key,$quick,$mime,$assembled,$destination){
            $uid=$auth['user']['id'];$existing=query_one($db,'SELECT * FROM tracks WHERE owner_id=? AND sha256=? AND deleted=0',[$uid,$upload['sha256']]);
            if($existing){execute($db,"UPDATE uploads SET status='complete',completed_track_id=? WHERE id=?",[$existing['id'],$upload['id']]);return ['track'=>$existing,'album'=>album_row($db,$existing['album_id']),'changeId'=>null];}
            $user=query_one($db,'SELECT quota_bytes,used_bytes FROM users WHERE id=?',[$uid]);if($user['quota_bytes']!==null&&(int)$user['used_bytes']+(int)$upload['size_bytes']>(int)$user['quota_bytes'])fail('quota','There is not enough space in your account.',413);
            $trackArtist=ensure_artist($db,$m['artist'],$a['title']);$identityKey=album_merge_key($a['artistName'],$a['title']);$albumKey=$a['importKey']?hash('sha256',$identityKey."\x1f".$a['importKey']):$identityKey;
            $album=$a['existingAlbumId']?query_one($db,'SELECT * FROM albums WHERE id=? AND owner_id=? AND deleted=0',[$a['existingAlbumId'],$uid]):query_one($db,'SELECT * FROM albums WHERE owner_id=? AND merge_key=? AND deleted=0',[$uid,$albumKey]);
            if($a['existingAlbumId']&&!$album)fail('forbidden','Choose an album that belongs to you.',403);
            $newAlbum=false;
            if(!$album){$albumArtist=ensure_artist($db,$a['artistName'],$a['title']);$albumId=ulid();execute($db,'INSERT INTO albums(id,owner_id,title,artist_id,artist_name,year,tint,visibility,folder_path,created_at,rev,merge_key,identity_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[$albumId,$uid,$a['title'],$albumArtist['id'],$a['artistName'],$a['year'],cover_tint($a['artistName'],$a['title']),$input['visibility'],$a['folderPath'],now_ms(),next_rev($db),$albumKey,$identityKey]);$album=album_row($db,$albumId);$newAlbum=true;}
            $visibility=(int)$album['sync_visibility']===1?$album['visibility']:$input['visibility'];$trackId=ulid();$clock=now_ms();
            $row=['id'=>$trackId,'owner_id'=>$uid,'album_id'=>$album['id'],'artist_id'=>$trackArtist['id'],'title'=>$m['title'],'artist_name'=>$m['artist'],'album_artist'=>$m['albumArtist'],'album_title'=>$album['title'],'track_no'=>$m['trackNo'],'disc_no'=>$m['discNo'],'year'=>$m['year'],'genre'=>$m['genre'],'bpm'=>$m['bpm'],'duration_ms'=>$m['durationMs'],'codec'=>$m['codec'],'container'=>$m['container'],'bitrate'=>$m['bitrate'],'sample_rate'=>$m['sampleRate'],'bit_depth'=>$m['bitDepth'],'channels'=>$m['channels'],'replaygain_track_db'=>$m['replaygainTrackDb'],'replaygain_album_db'=>$m['replaygainAlbumDb'],'has_lyrics'=>$m['lyrics']!==null?1:0,'lyrics'=>$m['lyrics'],'lyrics_synced'=>$m['lyricsSynced']?1:0,'peaks'=>$input['peaks'],'storage_key'=>$key,'size_bytes'=>(int)$upload['size_bytes'],'sha256'=>$upload['sha256'],'quick_hash'=>$quick,'original_name'=>$upload['filename'],'original_path'=>$m['originalPath'],'mime'=>$mime,'visibility'=>$visibility,'organise_source'=>$m['organiseSource'],'added_at'=>$clock,'updated_at'=>$clock,'rev'=>next_rev($db),'deleted'=>0];
            // Repeated completion can recover after a database/process failure. The
            // immutable key contains owner + full SHA, never an untrusted filename.
            if(!is_file($destination)){if(!rename($assembled,$destination))fail('storage','Cannot save the uploaded file.',503);@chmod($destination,0600);}
            else{if(!hash_equals($upload['sha256'],hash_file('sha256',$destination)))fail('storage','Stored media needs repair before this upload can complete.',503);unlink($assembled);}
            execute($db,'INSERT INTO tracks('.implode(',',array_keys($row)).') VALUES('.implode(',',array_fill(0,count($row),'?')).')',array_values($row));execute($db,'UPDATE users SET used_bytes=used_bytes+? WHERE id=?',[$upload['size_bytes'],$uid]);
            $ops=[['table'=>'tracks','id'=>$trackId,'before'=>null,'after'=>$row]];if($newAlbum)$ops[]=['table'=>'albums','id'=>$album['id'],'before'=>null,'after'=>query_one($db,'SELECT * FROM albums WHERE id=?',[$album['id']])];
            $change=log_change($db,$auth,'Uploaded '.$m['title'],$ops);execute($db,"UPDATE uploads SET status='complete',completed_track_id=?,completed_change_id=? WHERE id=?",[$trackId,$change,$upload['id']]);return ['track'=>$row,'album'=>album_row($db,$album['id']),'changeId'=>$change];
        });
        clear_upload_parts($db,$id);return $result;
    });
}
function uploads_routes(PDO $db,array $auth,string $path,string $method): bool {
    if(!str_starts_with($path,'/api/uploads'))return false;$cfg=settings($db);require_upload($auth,$cfg);$userId=$auth['user']['id'];
    if($path==='/api/uploads/check'&&$method==='POST'){
        $input=body();$items=$input['items']??null;if(!is_array($items)||count($items)>1000)fail('validation','Check up to 1000 files at a time.');$duplicates=[];
        foreach($items as $item){if(!is_array($item)||!is_string($item['quickHash']??null)||!preg_match('/^[a-f0-9]{64}$/D',$item['quickHash'])||!is_int($item['size']??null)||$item['size']<1)fail('validation','Invalid duplicate-check item.');if(query_one($db,'SELECT id FROM tracks WHERE owner_id=? AND quick_hash=? AND size_bytes=? AND deleted=0',[$userId,$item['quickHash'],$item['size']]))$duplicates[]=$item['quickHash'];}
        reply(['duplicates'=>array_values(array_unique($duplicates)),'quotaLeft'=>quota_left($db,$userId)]);
    }
    if($path==='/api/uploads'&&$method==='POST'){
        $input=upload_input(body(),(int)$cfg['max_file_bytes']);$upload=transaction($db,function()use($db,$auth,$userId,$input){
            execute($db,"UPDATE uploads SET status='aborted' WHERE user_id=? AND status='open' AND expires_at<?",[$userId,now_ms()]);
            $existing=query_one($db,"SELECT u.* FROM uploads u LEFT JOIN tracks t ON t.id=u.completed_track_id WHERE u.user_id=? AND u.sha256=? AND (u.status='open' OR u.status='complete' AND t.deleted=0) ORDER BY u.created_at DESC LIMIT 1",[$userId,$input['sha256']]);if($existing)return $existing;
            $user=query_one($db,'SELECT quota_bytes,used_bytes FROM users WHERE id=?',[$userId]);$reserved=(int)query_one($db,"SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM uploads WHERE user_id=? AND status='open' AND expires_at>?",[$userId,now_ms()])['bytes'];
            if($user['quota_bytes']!==null&&(int)$user['used_bytes']+$reserved+$input['size']>(int)$user['quota_bytes'])fail('quota','There is not enough space in your account.',413);
            charge_upload_rate($db,$auth,$input['size']);$id=ulid();$clock=now_ms();execute($db,'INSERT INTO uploads(id,user_id,filename,size_bytes,sha256,chunk_bytes,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',[$id,$userId,$input['filename'],$input['size'],$input['sha256'],max_chunk_bytes(),$clock,$clock+7*86400000]);return query_one($db,'SELECT * FROM uploads WHERE id=?',[$id]);
        });reply(upload_result($db,$upload),201);
    }
    if(!preg_match('~^/api/uploads/([0-9A-HJKMNP-TV-Z]{26})(?:/parts/([0-9]+)|/(complete))?$~',$path,$match))return false;
    $id=$match[1];$upload=upload_record($db,$auth,$id);$part=$match[2]??'';$complete=($match[3]??'')==='complete';
    if($method==='GET'&&$part===''&&!$complete)reply(upload_result($db,$upload));
    if($method==='DELETE'&&$part===''&&!$complete){upload_lock($id,function()use($db,$auth,$id){$u=upload_record($db,$auth,$id);if($u['status']==='complete')fail('upload_closed','This upload is already in the library.',409);execute($db,"UPDATE uploads SET status='aborted' WHERE id=?",[$id]);clear_upload_parts($db,$id);});reply(['ok'=>true]);}
    if($method==='POST'&&$complete)reply(complete_upload($db,$auth,$id,completion_input(body())));
    if($method==='PUT'&&$part!==''){
        if($upload['status']!=='open'||(int)$upload['expires_at']<now_ms())fail('upload_closed','This upload is no longer open.',409);$n=(int)$part;$expected=min((int)$upload['chunk_bytes'],(int)$upload['size_bytes']-($n-1)*(int)$upload['chunk_bytes']);if($n<1||$expected<=0)fail('invalid_part','Part size or number is invalid.');
        $temporary=upload_directory($id).'/'.$n.'.'.bin2hex(random_bytes(8)).'.tmp';$in=fopen('php://input','rb');$out=fopen($temporary,'wb');if(!$in||!$out)fail('storage','Cannot store an upload part.',503);
        try{try{$received=stream_copy_to_stream($in,$out,$expected+1);}finally{fclose($in);fclose($out);}if($received!==$expected)fail('invalid_part','Part size or number is invalid.');$hash=hash_file('sha256',$temporary);
            upload_lock($id,function()use($db,$auth,$id,$n,$expected,$hash,$temporary){$upload=upload_record($db,$auth,$id);if($upload['status']!=='open')fail('upload_closed','This upload is no longer open.',409);$old=query_one($db,'SELECT sha256 FROM upload_parts WHERE upload_id=? AND part_no=?',[$id,$n]);if($old){if(!hash_equals($old['sha256'],$hash))fail('part_conflict','This part differs from the stored part. Restart this upload.',409);return;}
                if(!rename($temporary,upload_directory($id).'/'.$n.'.part'))fail('storage','Cannot save an upload part.',503);execute($db,'INSERT INTO upload_parts(upload_id,part_no,size_bytes,sha256) VALUES(?,?,?,?)',[$id,$n,$expected,$hash]);});
        }finally{if(is_file($temporary))unlink($temporary);}reply(['received'=>$n]);
    }
    return false;
}
