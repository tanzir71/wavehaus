<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/server-php/lib/migrate.php';
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$directory=$input['directory'];if(!is_dir($directory))mkdir($directory,0700,true);
$db=new PDO('sqlite:'.$directory.'/test.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$db->exec('PRAGMA foreign_keys=ON');
if($input['upgrade']){
    migrate($db,$directory,$input['m1']);
    $db->exec(file_get_contents(dirname(__DIR__).'/fixtures/migrations-m1.sql'));
}
migrate($db,$directory,$input['latest'],$input['legacy']);migrate($db,$directory,$input['latest'],$input['legacy']);
$shape=[];foreach($db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN)as $table){$shape[$table]=['columns'=>$db->query('PRAGMA table_info("'.$table.'")')->fetchAll(),'foreignKeys'=>$db->query('PRAGMA foreign_key_list("'.$table.'")')->fetchAll()];}
$track=$db->query('SELECT id,title,album_id,visibility FROM tracks')->fetch();$album=$db->query('SELECT id,title,owner_id,visibility FROM albums')->fetch();
echo json_encode(['shape'=>$shape,'track'=>$track,'album'=>$album,'foreignKeys'=>$db->query('PRAGMA foreign_key_check')->fetchAll(),'fkEnabled'=>(int)$db->query('PRAGMA foreign_keys')->fetchColumn(),'setting'=>$db->query("SELECT value FROM settings WHERE key='server_name'")->fetchColumn(),'homepageSettings'=>(int)$db->query("SELECT COUNT(*) FROM settings WHERE key='homepage'")->fetchColumn(),'migrations'=>(int)$db->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn()],JSON_THROW_ON_ERROR);
