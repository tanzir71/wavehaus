<?php
declare(strict_types=1);
function media_offload_header(string $file,string $root,string $mode='php',string $uri=''): ?array {
    if($mode===''||$mode==='php')return null;
    if(!in_array($mode,['x-sendfile','litespeed'],true))fail('configuration','MEDIA_OFFLOAD must be php, x-sendfile or litespeed.',503);
    $resolved=realpath($file);$directory=realpath($root);
    if(!$resolved||!$directory)fail('not_found','Audio file not found.',404);
    $normalized=str_replace('\\','/',$resolved);$directory=rtrim(str_replace('\\','/',$directory),'/');
    if(!str_starts_with($normalized,$directory.'/')||preg_match('/[\r\n\x00]/',$normalized))fail('configuration','Audio storage path is invalid.',503);
    $relative=substr($normalized,strlen($directory)+1);
    // Only immutable music objects may be delegated. Config, database, artwork,
    // traversal and symlinks outside the media directory never reach a header.
    if(!preg_match('~^[0-9A-HJKMNP-TV-Z]{26}/[a-f0-9]{64}$~D',$relative))fail('configuration','Audio storage path is invalid.',503);
    if($mode==='x-sendfile')return ['X-Sendfile',$resolved];
    if(strlen($uri)>200||!preg_match('~^/(?:[A-Za-z0-9_-]+/)+$~D',$uri))fail('configuration','Set MEDIA_OFFLOAD_URI to the protected LiteSpeed context URI, including its final slash.',503);
    return ['X-LiteSpeed-Location',$uri.$relative];
}
function media_range(?string $header,int $size): array {
    $start=0;$end=$size-1;$status=200;
    if($header){if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$header,$match)||$match[1]===''&&$match[2]==='')return ['status'=>416,'length'=>0,'range'=>'bytes */'.$size];
        if($match[1]==='')$start=max(0,$size-(int)$match[2]);else{$start=(int)$match[1];if($match[2]!=='')$end=min($end,(int)$match[2]);}
        if($start>$end||$start>=$size)return ['status'=>416,'length'=>0,'range'=>'bytes */'.$size];$status=206;
    }
    return ['status'=>$status,'start'=>$start,'end'=>$end,'length'=>max(0,$end-$start+1),'range'=>$status===206?'bytes '.$start.'-'.$end.'/'.$size:null];
}
function stream_media_file(string $file,string $mime,string $etag,string $method,bool $audio): never {
    if(!is_file($file))fail('not_found',$audio?'Audio file not found.':'Artwork has not arrived yet.',404);
    $size=filesize($file);header('Content-Type: '.$mime);header('Cache-Control: '.($audio?'private, no-store':'private, max-age=31536000, immutable'));header('Vary: Cookie, Authorization');header('ETag: '.$etag);
    if(!$audio){header('Content-Length: '.$size);if($method!=='HEAD')readfile($file);exit;}
    header('Accept-Ranges: bytes');$raw=$_SERVER['HTTP_RANGE']??null;if(isset($_SERVER['HTTP_IF_RANGE'])&&$_SERVER['HTTP_IF_RANGE']!==$etag)$raw=null;
    if(($_SERVER['HTTP_IF_NONE_MATCH']??'')===$etag&&!isset($_SERVER['HTTP_RANGE'])){http_response_code(304);exit;}
    $range=media_range($raw,$size);
    if($range['status']!==416){
        $offload=media_offload_header($file,data_dir().'/media',defined('MEDIA_OFFLOAD')?(string)MEDIA_OFFLOAD:'php',defined('MEDIA_OFFLOAD_URI')?(string)MEDIA_OFFLOAD_URI:'');
        // mod_xsendfile accepts a 200 response and delegates Range handling to
        // Apache's filters. Do not emit a partial status, length or body first.
        // Keep the existing PHP semantics for combined conditional/range input.
        if($offload&&!(isset($_SERVER['HTTP_IF_NONE_MATCH'])&&isset($_SERVER['HTTP_RANGE']))){http_response_code(200);header($offload[0].': '.$offload[1]);exit;}
    }
    http_response_code($range['status']);header('Content-Length: '.$range['length']);if($range['range'])header('Content-Range: '.$range['range']);if($method==='HEAD'||$range['status']===416)exit;
    $handle=fopen($file,'rb');if(!$handle)fail('storage','Cannot open the audio file.',503);fseek($handle,$range['start']);$remaining=$range['length'];
    while($remaining>0&&!connection_aborted()){$chunk=fread($handle,min(65536,$remaining));if($chunk===false||$chunk==='')break;echo $chunk;$remaining-=strlen($chunk);if(ob_get_level())ob_flush();flush();}fclose($handle);exit;
}
function serve_media(PDO $db,array $auth,string $path,string $method): never {
    if(!in_array($method,['GET','HEAD'],true))fail('not_found','Not found.',404);
    if(preg_match('~^/media/([0-9A-HJKMNP-TV-Z]{26})$~',$path,$match)){$track=readable_track($db,$auth,$match[1]);stream_media_file(data_dir().'/'.$track['storage_key'],$track['mime'],'"'.$track['sha256'].'"',$method,true);}
    if(preg_match('~^/art/([0-9A-HJKMNP-TV-Z]{26})/(96\.webp|600\.webp|generated-512\.png)$~',$path,$match)){
        $album=album_row($db,$match[1]);if(!$album||$album['deleted'])fail('not_found','Album not found.',404);if($album['owner_id']!==$auth['user']['id']&&$album['visibility']!=='public'&&!query_one($db,"SELECT id FROM tracks WHERE album_id=? AND visibility='public' AND deleted=0 LIMIT 1",[$album['id']]))fail('forbidden','This artwork is private.',403);if(!$album['art_key'])fail('not_found','Artwork has not arrived yet.',404);
        $base=data_dir().'/'.$album['art_key'];$name=$match[2];if(!is_file($base.'/'.$name)&&$name==='96.webp')$name='600.webp';$metadata=is_file($base.'/mime.json')?json_decode(file_get_contents($base.'/mime.json'),true):[];stream_media_file($base.'/'.$name,$metadata[$name]??'image/png','"'.hash('sha256',$album['art_key'].'/'.$name).'"',$method,false);
    }
    fail('not_found','Not found.',404);
}
