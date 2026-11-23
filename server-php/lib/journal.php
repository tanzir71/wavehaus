<?php
declare(strict_types=1);

// Native PHP counterpart of shared/journal.ts and the Worker journal adapter.
// Streaming reads and small placeholder groups keep older PDO SQLite builds
// usable without requiring SQLite's optional JSON functions.
function journal_columns(): array { return [
    'tracks'=>['owner_id','album_id','artist_id','title','artist_name','album_artist','album_title','track_no','disc_no','year','genre','bpm','duration_ms','codec','container','bitrate','sample_rate','bit_depth','channels','replaygain_track_db','replaygain_album_db','has_lyrics','lyrics','lyrics_synced','peaks','storage_key','size_bytes','sha256','quick_hash','original_name','original_path','mime','visibility','organise_source','added_at','deleted'],
    'albums'=>['owner_id','title','artist_id','artist_name','year','art_source','art_key','tint','visibility','sync_visibility','folder_path','created_at','deleted','merge_key','identity_key'],
    'artists'=>['name','sort_name','tint','deleted','name_key']
]; }
function journal_conflict(array $rows=[]): never { throw new ApiException('conflict','Some rows changed after this action. Your library has not been changed.',409,null,$rows); }
function journal_ids(mixed $value,string $label='Action IDs'): array {
    if(!is_array($value)||!array_is_list($value)||!count($value)||count($value)>2000)fail('validation',$label.' must contain 1–2000 valid IDs.');
    foreach($value as $id)if(!is_string($id)||!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$id))fail('validation',$label.' must contain valid IDs.');return array_values(array_unique($value));
}
function journal_op(string $table,?array $before,array $after): ?array {
    $columns=journal_columns();if(!isset($columns[$table]))fail('not_undoable','This action uses an unsupported record type.');
    $previous=$before?['id'=>$before['id'],'rev'=>$before['rev']]:null;$next=['id'=>$after['id'],'rev'=>$after['rev']];$changed=false;
    foreach($columns[$table]as $column){if(!array_key_exists($column,$after))continue;if($before&&array_key_exists($column,$before)&&$before[$column]===$after[$column])continue;$next[$column]=$after[$column];if($previous!==null)$previous[$column]=$before[$column]??null;$changed=true;}
    return $changed?['table'=>$table,'id'=>$after['id'],'before'=>$previous,'after'=>$next]:null;
}
function journal_compact(array $op): array {
    if(!isset(journal_columns()[$op['table']??'']))fail('not_undoable','This action uses an unsupported record type.');
    if(!isset($op['after']['id'],$op['after']['rev'])||!is_int($op['after']['rev'])||$op['after']['id']!==$op['id'])fail('not_undoable','This saved action is incomplete.');
    if(($op['before']??null)===null)return ['table'=>$op['table'],'id'=>$op['id'],'before'=>null,'after'=>['id'=>$op['id'],'rev'=>$op['after']['rev']]];
    if(!isset($op['before']['id'],$op['before']['rev'])||!is_int($op['before']['rev'])||$op['before']['id']!==$op['id'])fail('not_undoable','This saved action is incomplete.');
    return journal_op($op['table'],$op['before'],$op['after'])??['table'=>$op['table'],'id'=>$op['id'],'before'=>['id'=>$op['id'],'rev'=>$op['before']['rev']],'after'=>['id'=>$op['id'],'rev'=>$op['after']['rev']]];
}
function journal_read_changes(PDO $db,array $auth,array $ids): array {
    $changes=[];$bytes=0;$count=0;
    foreach(array_chunk($ids,200)as $group){
        $marks=implode(',',array_fill(0,count($group),'?'));$query=$db->prepare('SELECT id,created_at,undone_at,undoable,ops FROM changes WHERE user_id=? AND id IN('.$marks.')');$query->execute([$auth['user']['id'],...$group]);
        while($row=$query->fetch()){$legacy=json_decode($row['ops'],true,512,JSON_THROW_ON_ERROR);$row['ops']=[];foreach($legacy as $op){$op=journal_compact($op);$bytes+=strlen(json_encode($op,JSON_THROW_ON_ERROR));if($bytes>16*1024**2||++$count>10000)fail('too_large','Undo fewer actions at once.',413);$row['ops'][]=$op;}$changes[$row['id']]=$row;}
        $query->closeCursor();
        $query=$db->prepare('SELECT o.* FROM change_ops o JOIN changes c ON c.id=o.change_id WHERE c.user_id=? AND c.id IN('.$marks.') ORDER BY o.position');$query->execute([$auth['user']['id'],...$group]);
        while($row=$query->fetch()){$bytes+=strlen($row['before_json']??'')+strlen($row['after_json']);if($bytes>16*1024**2||++$count>10000)fail('too_large','Undo fewer actions at once.',413);$op=['table'=>$row['table_name'],'id'=>$row['row_id'],'before'=>$row['before_json']===null?null:json_decode($row['before_json'],true,512,JSON_THROW_ON_ERROR),'after'=>json_decode($row['after_json'],true,512,JSON_THROW_ON_ERROR)];$changes[$row['change_id']]['ops'][]=journal_compact($op);}
        $query->closeCursor();
    }
    if(count($changes)!==count($ids))fail('not_found','An action was not found in your activity.',404);return array_values($changes);
}
function journal_read_rows(PDO $db,array $ops): array {
    $current=[];$bytes=0;
    foreach(journal_columns()as $table=>$allowed){$selected=array_values(array_filter($ops,fn($op)=>$op['table']===$table));if(!$selected)continue;
        $columns=['id','rev','deleted'];if($table!=='artists')$columns=[...$columns,'owner_id','visibility'];if($table==='tracks')$columns=[...$columns,'album_id','artist_id'];if($table==='albums')$columns[]='artist_id';
        foreach($selected as $op)foreach(array_merge(array_keys($op['before']??[]),array_keys($op['after']))as $column)if(in_array($column,$allowed,true))$columns[]=$column;
        $names=implode(',',array_map(fn($name)=>'"'.$name.'"',array_unique($columns)));
        foreach(array_chunk(array_values(array_unique(array_column($selected,'id'))),200)as $ids){$query=$db->prepare('SELECT '.$names.' FROM '.$table.' WHERE id IN('.implode(',',array_fill(0,count($ids),'?')).')');$query->execute($ids);
            while($row=$query->fetch()){$bytes+=strlen(json_encode($row,JSON_THROW_ON_ERROR));if($bytes>16*1024**2)fail('too_large','Undo fewer actions at once.',413);$current[$table.':'.$row['id']]=$row;}$query->closeCursor();
        }
    }return $current;
}
function journal_undo_plan(array $changes,array $current): array {
    if(!$changes||count($changes)>2000)fail('validation','Choose up to 2000 actions to undo.');$operations=[];$sequence=0;$clock=now_ms();
    foreach($changes as $change){if($change['undone_at']!==null)fail('already_undone','An action in this batch was already undone.',409);if((int)$change['created_at']<$clock-30*86400000)fail('undo_expired','Undo is available for 30 days.',409);if(!$change['ops']||isset($change['undoable'])&&!$change['undoable'])fail('not_undoable','This action cannot be undone.');foreach($change['ops']as $op)$operations[]=['op'=>$op,'sequence'=>$sequence++];}
    if(count($operations)>10000)fail('too_large','Undo fewer actions at once.',413);
    usort($operations,fn($a,$b)=>$b['op']['after']['rev']<=>$a['op']['after']['rev']?:$b['sequence']<=>$a['sequence']);$virtual=$current;$touched=[];$conflicts=[];
    foreach($operations as ['op'=>$op]){$table=$op['table'];$key=$table.':'.$op['id'];$touched[$key]=['table'=>$table,'id'=>$op['id']];$row=$virtual[$key]??null;if(!$row||(int)$row['rev']!==$op['after']['rev']){$conflicts[$key]=$touched[$key];continue;}
        if($op['before']!==null){foreach(journal_columns()[$table]as $column)if(array_key_exists($column,$op['before']))$row[$column]=$op['before'][$column];$row['rev']=$op['before']['rev'];}else{$row['deleted']=1;$row['rev']=0;}$virtual[$key]=$row;
    }
    if($conflicts)journal_conflict(array_values($conflicts));$ops=[];$guards=[];
    foreach($touched as $key=>$record){$before=$current[$key];$guards[]=['table'=>$record['table'],'id'=>$record['id'],'rev'=>$before['rev']];$op=journal_op($record['table'],$before,$virtual[$key]);if($op)$ops[]=$op;}
    return ['ops'=>$ops,'guards'=>$guards,'virtual'=>$virtual,'changeIds'=>array_column($changes,'id')];
}
function journal_reference_guards(PDO $db,array $ops,array $virtual): array {
    $deletingAlbums=[];$deletingArtists=[];foreach($ops as $op)if(($op['after']['deleted']??null)===1&&($op['before']['deleted']??0)!==1){if($op['table']==='albums')$deletingAlbums[]=$op['id'];if($op['table']==='artists')$deletingArtists[]=$op['id'];}
    $tracks=[];$albums=[];foreach($virtual as $key=>$row){if(str_starts_with($key,'tracks:'))$tracks[$row['id']]=$row;if(str_starts_with($key,'albums:'))$albums[$row['id']]=$row;}$conflicts=[];
    foreach($deletingAlbums as $id)foreach($tracks as $row)if(!$row['deleted']&&$row['album_id']===$id)$conflicts['albums:'.$id]=['table'=>'albums','id'=>$id];
    foreach($deletingArtists as $id)foreach(array_merge(array_values($tracks),array_values($albums))as $row)if(!$row['deleted']&&$row['artist_id']===$id)$conflicts['artists:'.$id]=['table'=>'artists','id'=>$id];
    $guards=[];$definitions=[['tracks','album_id',$deletingAlbums,$tracks,'albums'],['tracks','artist_id',$deletingArtists,$tracks,'artists'],['albums','artist_id',$deletingArtists,$albums,'artists']];
    foreach($definitions as [$table,$column,$ids,$affected,$target])foreach(array_chunk($ids,200)as $group){$counts=array_fill_keys($group,0);$query=$db->prepare('SELECT id,'.$column.' AS target_id FROM '.$table.' WHERE deleted=0 AND '.$column.' IN('.implode(',',array_fill(0,count($group),'?')).')');$query->execute($group);
        while($row=$query->fetch()){$counts[$row['target_id']]++;if(!isset($affected[$row['id']]))$conflicts[$target.':'.$row['target_id']]=['table'=>$target,'id'=>$row['target_id']];}$query->closeCursor();foreach($counts as $id=>$count)$guards[]=['table'=>$table,'column'=>$column,'id'=>$id,'count'=>$count];
    }
    if($conflicts)journal_conflict(array_values($conflicts));return $guards;
}
function journal_write(PDO $db,array $auth,array $plan): array {
    if($auth['user']['role']==='listener')fail('forbidden','Your account cannot edit library metadata.',403);
    $ops=$plan['ops'];if(count($ops)>10000||count($plan['undoIds']??[])>2000)fail('too_large','Choose fewer records at once.',413);if(strlen(json_encode($ops,JSON_THROW_ON_ERROR))>16*1024**2)fail('too_large','This edit needs too much undo data. Choose fewer rows.',413);
    if(!$ops&&empty($plan['undoIds']))return ['changeId'=>$plan['appendTo']??null,'updated'=>0];$seen=[];foreach($ops as $op){$key=$op['table'].':'.$op['id'];if(isset($seen[$key]))throw new RuntimeException('Consolidate record operations before committing.');$seen[$key]=true;}
    try{return transaction($db,function()use($db,$auth,$plan,$ops){
        $clock=now_ms();$actor=query_one($db,'SELECT role,status FROM users WHERE id=?',[$auth['user']['id']]);if(!$actor||$actor['status']!=='active'||$actor['role']==='listener')journal_conflict();$admin=in_array($actor['role'],['owner','admin'],true);
        $guards=$plan['guards']??array_values(array_map(fn($op)=>['table'=>$op['table'],'id'=>$op['id'],'rev'=>$op['before']['rev']],array_filter($ops,fn($op)=>$op['before']!==null)));$conflicts=[];
        foreach($guards as $guard){if(!isset(journal_columns()[$guard['table']]))throw new RuntimeException('Invalid row guard.');$fields=$guard['table']==='artists'?'id,rev':'id,rev,owner_id';$row=query_one($db,'SELECT '.$fields.' FROM '.$guard['table'].' WHERE id=?',[$guard['id']]);if(!$row||(int)$row['rev']!==$guard['rev']||$guard['table']!=='artists'&&!$admin&&$row['owner_id']!==$auth['user']['id'])$conflicts[]=['table'=>$guard['table'],'id'=>$guard['id']];}
        if($conflicts)journal_conflict($conflicts);
        foreach($ops as $op)if($op['before']===null){if(query_one($db,'SELECT id FROM '.$op['table'].' WHERE id=?',[$op['id']]))journal_conflict([['table'=>$op['table'],'id'=>$op['id']]]);if($op['table']!=='artists'&&!$admin&&($op['after']['owner_id']??null)!==$auth['user']['id'])fail('forbidden','Choose records that belong to you.',403);}
        foreach($plan['counts']??[]as $guard){if(!in_array($guard['table'],['tracks','albums'],true)||!in_array($guard['column'],['album_id','artist_id'],true)||$guard['table']==='albums'&&$guard['column']!=='artist_id')throw new RuntimeException('Invalid reference guard.');if((int)query_one($db,'SELECT COUNT(*) AS n FROM '.$guard['table'].' WHERE '.$guard['column'].'=? AND deleted=0',[$guard['id']])['n']!==$guard['count'])journal_conflict();}
        $parentIds=array_values(array_unique([...($plan['undoIds']??[]),...(!empty($plan['appendTo'])?[$plan['appendTo']]:[])]));
        foreach($parentIds as $id){$parent=query_one($db,'SELECT id FROM changes WHERE id=? AND user_id=? AND undone_at IS NULL AND undoable=1 AND created_at>=?',[$id,$auth['user']['id'],$clock-30*86400000]);if(!$parent)journal_conflict();}
        if(!empty($plan['appendTo'])){$cost=query_one($db,'SELECT c.ops,(SELECT COUNT(*) FROM change_ops o WHERE o.change_id=c.id) AS n,(SELECT COALESCE(SUM(COALESCE(length(CAST(o.before_json AS BLOB)),0)+length(CAST(o.after_json AS BLOB))),0) FROM change_ops o WHERE o.change_id=c.id) AS bytes FROM changes c WHERE c.id=?',[$plan['appendTo']]);if(count(json_decode($cost['ops'],true,512,JSON_THROW_ON_ERROR))+(int)$cost['n']+count($ops)>10000||strlen($cost['ops'])+(int)$cost['bytes']+strlen(json_encode($ops,JSON_THROW_ON_ERROR))+32*count($ops)>16*1024**2)fail('too_large','This action has too much undo data.',413);}
        $changeId=$plan['appendTo']??ulid();if(empty($plan['appendTo']))execute($db,"INSERT INTO changes(id,user_id,actor,session_label,summary,ops,created_at,undoable) VALUES(?,?,'web',?,?,'[]',?,?)",[$changeId,$auth['user']['id'],$auth['session']['device_label'],$plan['summary'],$clock,($plan['undoable']??true)?1:0]);
        execute($db,'UPDATE revs SET n=n+? WHERE id=1',[count($ops)]);$base=(int)query_one($db,'SELECT n FROM revs WHERE id=1')['n']-count($ops);$columns=journal_columns();
        foreach(['artists','albums','tracks']as $table)foreach($ops as $index=>$op)if($op['table']===$table){$after=$op['after'];$fields=array_values(array_intersect($columns[$table],array_keys($after)));$revision=$base+$index+1;
            if($op['before']===null){$names=['id',...$fields,'rev'];$values=[$op['id'],...array_map(fn($column)=>$after[$column],$fields),$revision];execute($db,'INSERT INTO '.$table.'('.implode(',',array_map(fn($name)=>'"'.$name.'"',$names)).') VALUES('.implode(',',array_fill(0,count($names),'?')).')',$values);}
            else{$set=array_map(fn($name)=>'"'.$name.'"=?',$fields);$set[]='rev=?';$values=[...array_map(fn($name)=>$after[$name],$fields),$revision];if($table==='tracks'){$set[]='updated_at=?';$values[]=$clock;}if($table!=='artists'){$set[]="hidden_rev=CASE WHEN visibility='public' AND ?='private' THEN ? ELSE hidden_rev END";$values[]=$after['visibility']??($op['before']['visibility']??'');$values[]=$revision;}$values[]=$op['id'];execute($db,'UPDATE '.$table.' SET '.implode(',',$set).' WHERE id=?',$values);}
        }
        foreach($ops as $index=>$op){if($op['table']==='artists'&&$op['before']!==null&&!array_diff(array_keys($op['after']),['id','rev']))continue;$after=$op['after'];$after['rev']=$base+$index+1;execute($db,'INSERT INTO change_ops(change_id,position,table_name,row_id,before_json,after_json) VALUES(?,?,?,?,?,?)',[$changeId,$after['rev'],$op['table'],$op['id'],$op['before']===null?null:json_encode($op['before'],JSON_THROW_ON_ERROR),json_encode($after,JSON_THROW_ON_ERROR)]);}
        foreach($plan['undoIds']??[]as $id)execute($db,'UPDATE changes SET undone_at=? WHERE id=? AND user_id=?',[$clock,$id,$auth['user']['id']]);return ['changeId'=>$changeId,'updated'=>count(array_filter($ops,fn($op)=>$op['table']==='tracks'))];
    });}catch(PDOException $error){if(str_contains($error->getMessage(),'UNIQUE constraint failed'))journal_conflict();throw $error;}
}
function journal_activity(PDO $db,array $auth): never {
    $raw=$_GET['limit']??'50';if(!preg_match('/^[1-9]\d{0,2}$/D',$raw)||(int)$raw>100)fail('validation','Use an activity page size from 1 to 100.');$limit=(int)$raw;$cursor=$_GET['cursor']??'';$at=9007199254740991;$id=str_repeat('Z',26);
    if($cursor!==''){if(!preg_match('/^(\d{1,16})(?:\.([0-9A-HJKMNP-TV-Z]{26}))?$/D',$cursor,$match)||(float)$match[1]>9007199254740991)fail('validation','Invalid activity cursor.');$at=(int)$match[1];$id=$match[2]??$id;}
    $query=$db->prepare('SELECT c.*,(SELECT COUNT(*) FROM change_ops o WHERE o.change_id=c.id) AS child_count FROM changes c WHERE c.user_id=? AND (c.created_at<? OR(c.created_at=? AND c.id<?)) ORDER BY c.created_at DESC,c.id DESC LIMIT '.($limit+1));$query->execute([$auth['user']['id'],$at,$at,$id]);$items=[];$bytes=0;$more=false;
    while($row=$query->fetch()){$bytes+=strlen($row['ops'])+2048;if(count($items)>=$limit||$items&&$bytes>8*1024**2){$more=true;break;}$row['ops']=json_decode($row['ops'],true,512,JSON_THROW_ON_ERROR);$row['operationCount']=count($row['ops'])+(int)$row['child_count'];unset($row['child_count']);$row['undoAvailable']=$auth['user']['role']!=='listener'&&$row['undone_at']===null&&(int)$row['undoable']===1&&$row['operationCount']>0&&(int)$row['created_at']>=now_ms()-30*86400000;$items[]=$row;}$query->closeCursor();$last=$items?$items[count($items)-1]:null;reply(['items'=>$items,'nextCursor'=>$more&&$last?$last['created_at'].'.'.$last['id']:null]);
}
function journal_routes(PDO $db,array $auth,string $path,string $method): bool {
    if($path==='/api/changes'&&$method==='GET')journal_activity($db,$auth);
    $single=preg_match('~^/api/changes/([0-9A-HJKMNP-TV-Z]{26})/undo$~',$path,$match);if($method!=='POST'||!$single&&$path!=='/api/changes/undo')return false;
    if($auth['user']['role']==='listener')fail('forbidden','Your account cannot edit library metadata.',403);$ids=$single?[$match[1]]:journal_ids(body()['ids']??null);$changes=journal_read_changes($db,$auth,$ids);$ops=array_merge(...array_column($changes,'ops'));$current=journal_read_rows($db,$ops);$admin=in_array($auth['user']['role'],['owner','admin'],true);
    foreach($current as $key=>$row)if(!$admin&&!str_starts_with($key,'artists:')&&$row['owner_id']!==$auth['user']['id'])fail('forbidden','You can only undo changes to your own library.',403);
    $plan=journal_undo_plan($changes,$current);foreach($plan['ops']as $op)if($op['table']!=='artists'){$key=$op['table'].':'.$op['id'];$before=$current[$key];$after=$plan['virtual'][$key];if($before['owner_id']!==$auth['user']['id']&&$after['visibility']==='public'&&($before['visibility']!=='public'||$before['deleted']===1))fail('forbidden','Admins cannot publish another member’s music.',403);}
    $counts=journal_reference_guards($db,$plan['ops'],$plan['virtual']);$result=journal_write($db,$auth,['summary'=>count($ids)===1?'Undid a library change':'Undid '.count($ids).' library changes','ops'=>$plan['ops'],'guards'=>$plan['guards'],'counts'=>$counts,'undoIds'=>$plan['changeIds'],'undoable'=>false]);reply([...$result,'undone'=>$ids]);
}
