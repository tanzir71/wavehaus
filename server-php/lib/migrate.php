<?php
declare(strict_types=1);
function legacy_album_drop_sql(PDO $db): string {
    // SQLite before 3.35 has no DROP COLUMN. Rebuild without renaming the old
    // parent first, so tracks' foreign-key declarations keep their table name.
    $definition=$db->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='albums'")->fetchColumn();
    $definition=preg_replace('/^\s*allow_homepage\b[^\r\n]*(?:\r?\n|$)/m','',(string)$definition,1,$removed);
    if($removed!==1)throw new RuntimeException('Cannot identify the obsolete album column safely.');
    $definition=preg_replace('/^CREATE TABLE\s+albums\b/i','CREATE TABLE albums_wh_rebuild_0004',$definition,1,$renamed);
    if($renamed!==1)throw new RuntimeException('Cannot rebuild the albums table safely.');
    $columns=[];foreach($db->query('PRAGMA table_info(albums)')->fetchAll(PDO::FETCH_ASSOC)as $column)if($column['name']!=='allow_homepage')$columns[]='"'.str_replace('"','""',$column['name']).'"';
    $indexes=$db->query("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='albums' AND sql IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN);
    $names=implode(',',$columns);return $definition.'; INSERT INTO albums_wh_rebuild_0004('.$names.') SELECT '.$names.' FROM albums; DROP TABLE albums; ALTER TABLE albums_wh_rebuild_0004 RENAME TO albums; '.implode(';',$indexes).';';
}
function migrate(PDO $db, string $dataDir, string $migrationDir, bool $forceLegacyDrop = false): void {
    $lock = fopen($dataDir . '/migrate.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Cannot lock migrations.');
    try {
        $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at INTEGER NOT NULL)');
        $applied = array_map('intval', $db->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
        $files = glob($migrationDir . '/*.sql'); sort($files);
        foreach ($files as $file) {
            $version = (int)basename($file); if (in_array($version, $applied, true)) continue;
            if (count($applied)) {
                if (!is_dir($dataDir . '/backups')) mkdir($dataDir . '/backups', 0700, true);
                $backup = $dataDir . '/backups/wavehaus-' . sprintf('%04d',$version) . '-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(3)) . '.sqlite';
                // VACUUM INTO takes a consistent SQLite snapshot, including committed WAL pages.
                $db->exec('VACUUM INTO ' . $db->quote($backup));
                $backups = glob($dataDir . '/backups/*.sqlite'); rsort($backups); foreach (array_slice($backups, 5) as $old) unlink($old);
            }
            $sql=file_get_contents($file);$legacy=str_contains($sql,'ALTER TABLE albums DROP COLUMN allow_homepage')&&($forceLegacyDrop||version_compare((string)$db->query('SELECT sqlite_version()')->fetchColumn(),'3.35.0','<'));
            if($legacy){$sql=str_replace('ALTER TABLE albums DROP COLUMN allow_homepage;',legacy_album_drop_sql($db),$sql);$db->exec('PRAGMA foreign_keys=OFF');}
            try{
                $db->beginTransaction();
                try { $sql = preg_replace('/CREATE TABLE schema_migrations/', 'CREATE TABLE IF NOT EXISTS schema_migrations', $sql); $db->exec($sql);if($legacy&&$db->query('PRAGMA foreign_key_check')->fetch())throw new RuntimeException('Album migration failed its foreign-key check.');$stmt = $db->prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)'); $stmt->execute([$version, basename($file), (int)(microtime(true)*1000)]); $db->commit(); $applied[] = $version; }
                catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
            }finally{if($legacy)$db->exec('PRAGMA foreign_keys=ON');}
        }
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
