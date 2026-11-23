<?php
declare(strict_types=1);
$lib = is_dir(__DIR__.'/lib') ? __DIR__.'/lib' : dirname(__DIR__).'/lib';
require_once $lib.'/bootstrap.php';
require_once $lib.'/settings.php';
require_once $lib.'/ratelimit.php';
require_once $lib.'/auth.php';
require_once $lib.'/router.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Permissions-Policy: camera=(self)');
header("Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
try {
    $path=rawurldecode(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/');$method=$_SERVER['REQUEST_METHOD']??'GET';
    if(str_contains($path,"\0")||str_contains($path,'..')||preg_match('~^/(?:lib|migrations|data[^/]*|\.)~',$path))fail('not_found','Not found.',404);
    if(str_starts_with($path,'/api/')){
        if(!in_array($method,['GET','HEAD'],true)&&($_SERVER['HTTP_X_WAVEHAUS']??'')!=='1')fail('csrf','Missing X-Wavehaus header.',403);
        route_request(database(),$path,$method);
    }
    if($path==='/'){header('Location: /app/',true,302);exit;}
    if(preg_match('~^/(?:setup(?:/reset)?|pair|join(?:/[^/]+)?)$~',$path)){header('Location: /app'.$path,true,302);exit;}
    if(str_starts_with($path,'/app/')){
        $app=is_dir(__DIR__.'/app')?__DIR__.'/app':dirname(__DIR__,2).'/app/dist';
        $relative=substr($path,5);$real=realpath($app.'/'.$relative);$root=realpath($app);
        if($real&&$root&&str_starts_with($real,$root.DIRECTORY_SEPARATOR)&&is_file($real)){
            $ext=strtolower(pathinfo($real,PATHINFO_EXTENSION));$mime=['js'=>'text/javascript','css'=>'text/css','json'=>'application/json','webmanifest'=>'application/manifest+json','woff2'=>'font/woff2','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','webp'=>'image/webp','wav'=>'audio/wav','html'=>'text/html; charset=utf-8'][$ext]??'application/octet-stream';
            header('Content-Type: '.$mime);header('Content-Length: '.filesize($real));if($method!=='HEAD')readfile($real);exit;
        }
        if(!is_file($app.'/index.html'))fail('build_missing','Build the PWA with npm run build before starting the PHP preview.',503);
        header('Content-Type: text/html; charset=utf-8');header('Cache-Control: no-cache');if($method!=='HEAD')readfile($app.'/index.html');exit;
    }
    fail('not_found','Not found.',404);
} catch(ApiException $error){if($error->retryAfter!==null)header('Retry-After: '.$error->retryAfter);reply(['error'=>['code'=>$error->errorCode,'message'=>$error->getMessage(),...($error->retryAfter!==null?['retryAfter'=>$error->retryAfter]:[])]],$error->getCode());}
catch(Throwable $error){error_log('Wavehaus: '.get_class($error).' code '.$error->getCode().' at '.basename($error->getFile()).':'.$error->getLine());reply(['error'=>['code'=>'internal','message'=>'The server could not complete this request. Check its error log.']],500);}
