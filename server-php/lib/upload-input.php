<?php
declare(strict_types=1);

// Mirrors shared/upload-input.ts. This validates the client's analysis; PHP
// never parses tags, decodes audio, computes peaks or resizes artwork.
function upload_extension(string $filename): string { return strtolower(pathinfo($filename, PATHINFO_EXTENSION)); }
function upload_input(array $input, int $maxBytes): array {
    $filename=$input['filename']??null;
    if(!is_string($filename)||!trim($filename)||mb_strlen($filename)>500||preg_match('~[\\\\/\x00-\x1f]~',$filename))fail('invalid_filename','Choose a file with a valid name.');
    if(!in_array(upload_extension($filename),['mp3','flac','m4a','alac','opus','ogg','wav','aif','aiff'],true))fail('unsupported','This file type is not supported audio.',415);
    $size=$input['size']??null;if((!is_int($size)&&!is_float($size))||!is_finite((float)$size)||floor((float)$size)!==(float)$size||$size<12||$size>$maxBytes)fail('too_large','Choose an audio file up to '.(int)floor($maxBytes/1024**2).' MB.',413);$size=(int)$size;
    $sha=$input['sha256']??null;if(!is_string($sha)||!preg_match('/^[a-f0-9]{64}$/D',$sha))fail('invalid_hash','A SHA-256 hash is required.');
    return ['filename'=>$filename,'size'=>$size,'sha256'=>$sha];
}
function sniff_audio(string $header,string $filename): string {
    $ext=upload_extension($filename);
    if($ext==='mp3'&&(str_starts_with($header,'ID3')||strlen($header)>=2&&ord($header[0])===255&&(ord($header[1])&224)===224&&(ord($header[1])&6)!==0))return 'audio/mpeg';
    if($ext==='flac'&&str_starts_with($header,'fLaC'))return 'audio/flac';
    if(in_array($ext,['m4a','alac'],true)&&substr($header,4,4)==='ftyp')return 'audio/mp4';
    if(in_array($ext,['ogg','opus'],true)&&str_starts_with($header,'OggS'))return 'audio/ogg';
    if($ext==='wav'&&str_starts_with($header,'RIFF')&&substr($header,8,4)==='WAVE')return 'audio/wav';
    if(in_array($ext,['aif','aiff'],true)&&str_starts_with($header,'FORM')&&in_array(substr($header,8,4),['AIFF','AIFC'],true))return 'audio/aiff';
    fail('unsupported','The file contents do not match a supported audio format.',415);
}
function input_text(mixed $value,string $label,int $max=500,bool $required=false): ?string {
    if($value===null||$value===''){if($required)fail('validation',$label.' is required.');return null;}
    if(!is_string($value)||mb_strlen($value)>$max||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value))fail('validation',$label.' is invalid.');
    $result=trim($value);if($required&&$result==='')fail('validation',$label.' is required.');return $result===''?null:$result;
}
function input_number(mixed $value,string $label,int|float $max,bool $integer=true,int|float $min=0): int|float|null {
    if($value===null||$value==='')return null;
    if((!is_int($value)&&!is_float($value))||!is_finite((float)$value)||$value<$min||$value>$max||$integer&&floor((float)$value)!==(float)$value)fail('validation',$label.' is invalid.');
    return $integer?(int)$value:$value;
}
function input_path(mixed $value): ?string {
    $path=input_text($value,'Folder path',1500);
    if($path&&preg_match('~^[\\\\/]|^[a-z]:|\\\\|(?:^|/)\.\.(?:/|$)~i',$path))fail('validation','Use a relative folder path.');return $path;
}
function input_peaks(mixed $value): ?string {
    if($value===null||$value==='')return null;
    if(!is_string($value)||strlen($value)!==1336||!preg_match('~^[A-Za-z0-9+/]{1334}==$~D',$value)||strlen(base64_decode($value,true)?:'')!==1000)fail('invalid_peaks','Waveforms need exactly 1000 peak values.');return $value;
}
function completion_input(array $input): array {
    $m=$input['metadata']??null;$a=$input['album']??null;
    if(!is_array($m)||array_is_list($m)||!is_array($a)||array_is_list($a))fail('validation','Track metadata and album are required.');
    $artist=input_text($m['artist']??null,'Artist',200,true);$albumArtist=input_text($m['albumArtist']??null,'Album artist',200)??$artist;
    $visibility=$input['visibility']??'private';if(!in_array($visibility,['private','public'],true))fail('validation','Choose Private or Public.');
    $source=$m['organiseSource']??'filename';if(!in_array($source,['tags','folder','filename','manual','assistant'],true))fail('validation','Invalid metadata source.');
    $metadata=[
        'title'=>input_text($m['title']??null,'Title',500,true),'artist'=>$artist,'albumArtist'=>$albumArtist,'album'=>input_text($a['title']??null,'Album title',500,true),
        'trackNo'=>input_number($m['trackNo']??null,'Track number',9999),'discNo'=>input_number($m['discNo']??null,'Disc number',999),'year'=>input_number($m['year']??null,'Year',2999,true,1),
        'genre'=>input_text($m['genre']??null,'Genre',500),'bpm'=>input_number($m['bpm']??null,'BPM',1000,false),'durationMs'=>input_number($m['durationMs']??null,'Duration',7*86400000)??0,
        'codec'=>input_text($m['codec']??null,'Codec',100),'container'=>input_text($m['container']??null,'Container',100),'bitrate'=>input_number($m['bitrate']??null,'Bitrate',100000000),
        'sampleRate'=>input_number($m['sampleRate']??null,'Sample rate',768000),'bitDepth'=>input_number($m['bitDepth']??null,'Bit depth',64),'channels'=>input_number($m['channels']??null,'Channel count',64),
        'replaygainTrackDb'=>input_number($m['replaygainTrackDb']??null,'Track gain',120,false,-120),'replaygainAlbumDb'=>input_number($m['replaygainAlbumDb']??null,'Album gain',120,false,-120),
        'lyrics'=>input_text($m['lyrics']??null,'Lyrics',200000),'lyricsSynced'=>($m['lyricsSynced']??false)===true,'quickHash'=>input_text($m['quickHash']??null,'Quick hash',64),
        'originalPath'=>input_path($m['originalPath']??null),'organiseSource'=>$source
    ];
    if($metadata['quickHash']&&!preg_match('/^[a-f0-9]{64}$/D',$metadata['quickHash']))fail('invalid_hash','Invalid quick hash.');
    $existing=input_text($a['existingAlbumId']??null,'Album ID',26);if($existing&&!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/D',$existing))fail('validation','Invalid album ID.');
    return ['metadata'=>$metadata,'album'=>['title'=>$metadata['album'],'artistName'=>input_text($a['artistName']??null,'Album artist',200)??$albumArtist,'year'=>input_number($a['year']??$m['year']??null,'Year',2999,true,1),'folderPath'=>input_path($a['folderPath']??null),'existingAlbumId'=>$existing],'visibility'=>$visibility,'peaks'=>input_peaks($input['peaks']??null)];
}
function normalized_name(string $value): string { return preg_replace('/\s+/u',' ',trim(mb_strtolower($value,'UTF-8'))); }
function album_merge_key(string $artist,string $title): string { return hash('sha256',normalized_name($artist)."\x1f".normalized_name($title)); }
function cover_tint(string $artist,string $title): int {
    $hash=2166136261;foreach(unpack('C*',mb_strtolower($artist,'UTF-8').'|'.mb_strtolower($title,'UTF-8'))as $byte)$hash=(($hash^$byte)*16777619)&0xffffffff;return $hash%6;
}
