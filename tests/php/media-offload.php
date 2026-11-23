<?php
declare(strict_types=1);
function fail(string $code,string $message,int $status=400): never { throw new RuntimeException($code.':'.$status); }
require dirname(__DIR__,2).'/server-php/lib/media.php';
$root=sys_get_temp_dir().'/wavehaus-offload-'.bin2hex(random_bytes(8));
$owner='01J00000000000000000000001';$hash=str_repeat('a',64);$path=$root.'/media/'.$owner.'/'.$hash;
mkdir($root.'/media/'.$owner,0700,true);file_put_contents($path,'fixture');file_put_contents($root.'/private.php','private');
$checks=0;
function check(bool $value): void {global $checks;if(!$value)throw new RuntimeException('Offload assertion failed.');$checks++;}
function rejected(callable $call): void {try{$call();}catch(RuntimeException $error){check(str_starts_with($error->getMessage(),'configuration:503'));return;}throw new RuntimeException('Unsafe offload was accepted.');}
try{
 check(media_offload_header($path,$root.'/media')===null);
 check(media_offload_header($path,$root.'/media','x-sendfile')===['X-Sendfile',realpath($path)]);
 check(media_offload_header($path,$root.'/media','litespeed','/__wavehaus_media/')===['X-LiteSpeed-Location','/__wavehaus_media/'.$owner.'/'.$hash]);
 rejected(fn()=>media_offload_header($root.'/private.php',$root.'/media','x-sendfile'));
 rejected(fn()=>media_offload_header($path,$root.'/media','unknown'));
 foreach(['https://other.test/','//other.test/','/x/../media/','/x/?secret=','/x/%2e/','/x/' . "\r\n"]as $uri)rejected(fn()=>media_offload_header($path,$root.'/media','litespeed',$uri));
 file_put_contents($root.'/media/config.php','private');rejected(fn()=>media_offload_header($root.'/media/config.php',$root.'/media','x-sendfile'));unlink($root.'/media/config.php');
 echo $checks." media offload checks passed.\n";
}finally{unlink($path);unlink($root.'/private.php');rmdir($root.'/media/'.$owner);rmdir($root.'/media');rmdir($root);}
