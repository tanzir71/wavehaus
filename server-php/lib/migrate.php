<?php
declare(strict_types=1);
function migrate(PDO $db, string $dataDir, string $migrationDir): void {
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
            $db->beginTransaction();
            try { $sql = file_get_contents($file); $sql = preg_replace('/CREATE TABLE schema_migrations/', 'CREATE TABLE IF NOT EXISTS schema_migrations', $sql); $db->exec($sql); $stmt = $db->prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)'); $stmt->execute([$version, basename($file), (int)(microtime(true)*1000)]); $db->commit(); $applied[] = $version; }
            catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
        }
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
