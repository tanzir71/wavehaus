<?php
declare(strict_types=1);
function artwork_routes(PDO $db,array $auth,string $path,string $method): bool {
    $single=preg_match('~^/api/albums/([0-9A-HJKMNP-TV-Z]{26})/art$~',$path,$match);if($method!=='PUT'||!$single&&$path!=='/api/albums/art')return false;
    if($auth['user']['role']==='listener')fail('forbidden','Your account cannot edit artwork.',403);
    $limit=5*1024**2;if((int)($_SERVER['CONTENT_LENGTH']??0)>3*$limit+65536)fail('invalid_art','Choose artwork under 5 MB per image.',413);
    // PHP does not populate $_FILES for PUT. Read a bounded multipart body;
    // uploaded files never become paths supplied by the caller.
    $contentType=$_SERVER['CONTENT_TYPE']??'';
    if(!preg_match('/^multipart\/form-data;.*boundary=(?:"([^"\r\n]{1,200})"|([^;\s\r\n]{1,200}))/i',$contentType,$boundaryMatch))fail('invalid_art','Use multipart artwork.');
    $boundary=$boundaryMatch[1]!==''?$boundaryMatch[1]:$boundaryMatch[2];$stream=fopen('php://input','rb');$raw=stream_get_contents($stream,3*$limit+65537);fclose($stream);
    if(strlen($raw)>3*$limit+65536)fail('invalid_art','Choose artwork under 5 MB per image.',413);
    $parts=explode('--'.$boundary,$raw);$files=[];$source=null;$controls=[];
    foreach($parts as $part){$at=strpos($part,"\r\n\r\n");if($at===false)continue;$headers=substr($part,0,$at);$value=substr($part,$at+4);if(str_ends_with($value,"\r\n"))$value=substr($value,0,-2);if(!preg_match('/content-disposition:[^\r\n]*\bname="([^"\r\n]+)"/i',$headers,$field))continue;$name=$field[1];if($name==='source'){$source=$value;continue;}if(in_array($name,['albumIds','expectedRevs','changeId'],true)){if(isset($controls[$name]))fail('validation','Use each artwork control once.');$controls[$name]=$value;continue;}if(!in_array($name,['art600','art96','generated512','original'],true))continue;
        if(isset($files[$name])||strlen($value)<24||strlen($value)>$limit)fail('invalid_art','Choose artwork under 5 MB per image.',413);
        if($name==='original'){$mime=substr($value,0,8)==="\x89PNG\r\n\x1a\n"?'image/png':(substr($value,0,3)==="\xff\xd8\xff"?'image/jpeg':(substr($value,0,4)==='RIFF'&&substr($value,8,4)==='WEBP'?'image/webp':null));if(!$mime)fail('invalid_art','Use PNG, JPEG or WebP artwork.',415);$files[$name]=['bytes'=>$value,'mime'=>$mime,'filename'=>'600.webp'];continue;}
        $generated=$name==='generated512';$valid=$generated?substr($value,0,8)==="\x89PNG\r\n\x1a\n"&&substr($value,12,4)==='IHDR':substr($value,0,4)==='RIFF'&&substr($value,8,4)==='WEBP'&&in_array(substr($value,12,4),['VP8 ','VP8L','VP8X'],true);
        if(!$valid)fail('invalid_art',$generated?'Generated covers must be PNG images.':'Upload resized WebP covers.',415);
        $files[$name]=['bytes'=>$value,'mime'=>$generated?'image/png':'image/webp','filename'=>$generated?'generated-512.png':($name==='art600'?'600.webp':'96.webp')];
    }
    if(isset($files['original'])){if(count($files)!==1)fail('invalid_art','Send original artwork on its own.');$file=$files['original'];$files=['art600'=>$file,'art96'=>[...$file,'filename'=>'96.webp']];$source='uploaded';}
    if(!$files||isset($files['art600'])!==isset($files['art96']))fail('invalid_art','Send both 600 and 96 pixel covers, or a generated PNG.');
    $source=$source??(isset($files['generated512'])?'generated':'uploaded');if(!in_array($source,['embedded','folder','uploaded','generated'],true)||$source==='generated'&&!isset($files['generated512']))fail('invalid_art','Choose a valid artwork source with its image.');
    $parse=function(string $field)use($controls):mixed{if(!isset($controls[$field]))return null;try{return json_decode($controls[$field],false,64,JSON_THROW_ON_ERROR);}catch(JsonException){fail('validation','Invalid '.$field.'.');}};
    $ids=$single?[$match[1]]:journal_ids($parse('albumIds'),'Album IDs');$expected=[];if(isset($controls['expectedRevs']))foreach(metadata_object($parse('expectedRevs'),'Expected revisions')as $id=>$rev){if(!in_array($id,$ids,true)||!is_int($rev)||$rev<0||$rev>9007199254740991)fail('validation','Expected revisions must belong to the selected albums.');$expected[$id]=$rev;}
    $appendTo=$controls['changeId']??null;if($appendTo!==null&&!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$appendTo))fail('validation','Invalid action ID.');$before=[];foreach(array_chunk($ids,200)as $group)$before=array_merge($before,query_all($db,'SELECT id,rev,owner_id,title,art_key,art_source FROM albums WHERE deleted=0 AND id IN('.implode(',',array_fill(0,count($group),'?')).')',$group));
    if(count($before)!==count($ids))fail('not_found','An album was not found.',404);$stale=[];foreach($before as $row){if($row['owner_id']!==$auth['user']['id'])fail('forbidden','Choose albums that belong to you.',403);if(isset($expected[$row['id']])&&$expected[$row['id']]!==(int)$row['rev'])$stale[]=['table'=>'albums','id'=>$row['id']];}if($stale)journal_conflict($stale);
    $key='art/'.$auth['user']['id'].'/'.$ids[0].'/'.ulid();$directory=data_dir().'/'.$key;if(!mkdir($directory,0700,true)&&!is_dir($directory))fail('storage','Cannot store artwork.',503);
    try{$mimes=[];foreach($files as $file){if(file_put_contents($directory.'/'.$file['filename'],$file['bytes'],LOCK_EX)!==strlen($file['bytes']))fail('storage','Cannot store artwork.',503);$mimes[$file['filename']]=$file['mime'];}file_put_contents($directory.'/mime.json',json_encode($mimes,JSON_THROW_ON_ERROR),LOCK_EX);
        $result=journal_write($db,$auth,['summary'=>'Updated artwork for '.(count($ids)===1?$before[0]['title']:count($ids).' albums'),'appendTo'=>$appendTo,'ops'=>array_map(fn($row)=>['table'=>'albums','id'=>$row['id'],'before'=>['id'=>$row['id'],'rev'=>(int)$row['rev'],'art_key'=>$row['art_key'],'art_source'=>$row['art_source']],'after'=>['id'=>$row['id'],'rev'=>(int)$row['rev'],'art_key'=>$key,'art_source'=>$source]],$before)]);
    }catch(Throwable $error){foreach(array_merge(array_column($files,'filename'),['mime.json']) as $name)if(is_file($directory.'/'.$name))unlink($directory.'/'.$name);rmdir($directory);throw $error;}
    reply([...$result,'artSource'=>$source,'albumIds'=>$ids]);
}
