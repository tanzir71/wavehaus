<?php
declare(strict_types=1);
function app_directory(): string { return is_dir(dirname(__DIR__).'/app')?dirname(__DIR__).'/app':dirname(__DIR__,2).'/app/dist'; }
function app_base(): string {
    static $base;if($base!==null)return $base;
    $metadata=app_directory().'/deployment.json';$build=is_file($metadata)?json_decode(file_get_contents($metadata),true):[];$base=$build['base']??'/';
    if(!is_string($base)||!preg_match('~^/(?:[A-Za-z0-9_-]+/)*$~D',$base))fail('configuration','Build Wavehaus with a valid APP_BASE path.',503);return $base;
}
function app_relative_path(string $path): ?string { $base=app_base();if($base==='/')return $path;if($path===rtrim($base,'/'))return '/';return str_starts_with($path,$base)?'/'.substr($path,strlen($base)):null; }
