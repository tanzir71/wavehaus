<?php
declare(strict_types=1);
function artwork_routes(PDO $db,array $auth,string $path,string $method): bool {
    if($method!=='PUT'||!preg_match('~^/api/albums/([0-9A-HJKMNP-TV-Z]{26})/art$~',$path,$match))return false;
    $album=album_row($db,$match[1]);if(!$album||$album['deleted'])fail('not_found','Album not found.',404);
    if($album['owner_id']!==$auth['user']['id'])fail('forbidden','Choose an album that belongs to you.',403);
    $limit=5*1024**2;if((int)($_SERVER['CONTENT_LENGTH']??0)>3*$limit+65536)fail('invalid_art','Choose artwork under 5 MB per image.',413);
    // PHP does not populate $_FILES for PUT. Read a bounded multipart body;
    // uploaded files never become paths supplied by the caller.
    $contentType=$_SERVER['CONTENT_TYPE']??'';
    if(!preg_match('/^multipart\/form-data;.*boundary=(?:"([^"\r\n]{1,200})"|([^;\s\r\n]{1,200}))/i',$contentType,$boundaryMatch))fail('invalid_art','Use multipart artwork.');
    $boundary=$boundaryMatch[1]!==''?$boundaryMatch[1]:$boundaryMatch[2];$stream=fopen('php://input','rb');$raw=stream_get_contents($stream,3*$limit+65537);fclose($stream);
    if(strlen($raw)>3*$limit+65536)fail('invalid_art','Choose artwork under 5 MB per image.',413);
    $parts=explode('--'.$boundary,$raw);$files=[];$source=null;
    foreach($parts as $part){$at=strpos($part,"\r\n\r\n");if($at===false)continue;$headers=substr($part,0,$at);$value=substr($part,$at+4);if(str_ends_with($value,"\r\n"))$value=substr($value,0,-2);if(!preg_match('/content-disposition:[^\r\n]*\bname="([^"\r\n]+)"/i',$headers,$field))continue;$name=$field[1];if($name==='source'){$source=$value;continue;}if(!in_array($name,['art600','art96','generated512'],true))continue;
        if(isset($files[$name])||strlen($value)<24||strlen($value)>$limit)fail('invalid_art','Choose artwork under 5 MB per image.',413);
        $generated=$name==='generated512';$valid=$generated?substr($value,0,8)==="\x89PNG\r\n\x1a\n"&&substr($value,12,4)==='IHDR':substr($value,0,4)==='RIFF'&&substr($value,8,4)==='WEBP'&&in_array(substr($value,12,4),['VP8 ','VP8L','VP8X'],true);
        if(!$valid)fail('invalid_art',$generated?'Generated covers must be PNG images.':'Upload resized WebP covers.',415);
        $files[$name]=['bytes'=>$value,'mime'=>$generated?'image/png':'image/webp','filename'=>$generated?'generated-512.png':($name==='art600'?'600.webp':'96.webp')];
    }
    if(!$files||isset($files['art600'])!==isset($files['art96']))fail('invalid_art','Send both 600 and 96 pixel covers, or a generated PNG.');
    $source=$source??(isset($files['generated512'])?'generated':'uploaded');if(!in_array($source,['embedded','folder','uploaded','generated'],true)||$source==='generated'&&!isset($files['generated512']))fail('invalid_art','Choose a valid artwork source with its image.');
    $key='art/'.$auth['user']['id'].'/'.$album['id'].'/'.ulid();$directory=data_dir().'/'.$key;if(!mkdir($directory,0700,true)&&!is_dir($directory))fail('storage','Cannot store artwork.',503);
    try{$mimes=[];foreach($files as $file){if(file_put_contents($directory.'/'.$file['filename'],$file['bytes'],LOCK_EX)!==strlen($file['bytes']))fail('storage','Cannot store artwork.',503);$mimes[$file['filename']]=$file['mime'];}file_put_contents($directory.'/mime.json',json_encode($mimes,JSON_THROW_ON_ERROR),LOCK_EX);
        transaction($db,function()use($db,$auth,$album,$source,$key){$before=album_row($db,$album['id']);if(!$before||$before['deleted']||$before['owner_id']!==$auth['user']['id'])fail('forbidden','Choose an album that belongs to you.',403);execute($db,'UPDATE albums SET art_source=?,art_key=?,rev=? WHERE id=?',[$source,$key,next_rev($db),$album['id']]);log_change($db,$auth,'Updated artwork for '.$before['title'],[['table'=>'albums','id'=>$album['id'],'before'=>$before,'after'=>album_row($db,$album['id'])]]);});
    }catch(Throwable $error){foreach(array_merge(array_column($files,'filename'),['mime.json']) as $name)if(is_file($directory.'/'.$name))unlink($directory.'/'.$name);rmdir($directory);throw $error;}
    reply(['artSource'=>$source]);
}
