"""Independent ZIP/SQLite check; only Python's standard library is used."""
from contextlib import closing
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

root = Path(__file__).resolve().parents[2]
work = root / '.work'
work.mkdir(exist_ok=True)
temporary = Path(tempfile.mkdtemp(prefix='release-test-', dir=work)).resolve()
assert temporary.is_relative_to(work.resolve())
version = json.loads((root / 'package.json').read_text())['version']
archive = root / 'dist' / f'wavehaus-shared-hosting-v{version}.zip'
stage, data = temporary / 'public', temporary / 'private'
stage.mkdir()
data.mkdir()
for path in sorted((root / 'dist').glob(f'*-v{version}.zip')):
    with zipfile.ZipFile(path) as package:
        assert package.testzip() is None
        for entry in package.namelist():
            assert not Path(entry).is_absolute() and '..' not in Path(entry).parts
            assert Path(entry).name not in {'config.php', '.dev.vars'}
            assert '.sqlite' not in entry and 'node_modules/' not in entry
        assert package.read('VERSION').decode() == version
with zipfile.ZipFile(archive) as package:
    package.extractall(stage)

probe = subprocess.run(['php', '-r', 'echo json_encode([PHP_BINARY,get_loaded_extensions()]);'], check=True, capture_output=True, text=True)
php, extensions = json.loads(probe.stdout)
arguments = []
if os.name == 'nt':
    ext = Path(php).parent / 'ext'
    arguments += ['-d', f'extension_dir={ext}']
    for name in ['pdo_sqlite', 'mbstring', 'openssl', 'fileinfo']:
        if name not in extensions and (ext / f'php_{name}.dll').exists():
            arguments += ['-d', f'extension={name}']

def start(storage):
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    env = dict(os.environ, WAVEHAUS_DEV='1')
    if storage:
        env['WAVEHAUS_DATA_DIR'] = str(storage)
    else:
        env.pop('WAVEHAUS_DATA_DIR', None)
        # A file cannot contain ~/wavehaus-data: force the protected fallback.
        blocked_home = temporary / 'blocked-home'
        blocked_home.write_text('not a directory')
        env['HOME'] = str(blocked_home)
    log = open(temporary / f'php-{port}.log', 'wb')
    process = subprocess.Popen([php, *arguments, '-S', f'127.0.0.1:{port}', '-t', str(stage), str(stage / 'router.php')], env=env, stdout=log, stderr=log)
    app_base = json.loads((stage / 'app/deployment.json').read_text())['base'].rstrip('/')
    base = f'http://127.0.0.1:{port}' + app_base
    for _ in range(100):
        try:
            if urllib.request.urlopen(base + '/api/health').status == 200:
                return process, log, base
        except (urllib.error.URLError, ConnectionError):
            time.sleep(.05)
    process.terminate()
    raise AssertionError('Packaged PHP server did not become ready')

def call(base, path, method='GET', body=None, cookie=''):
    headers = {'Content-Type': 'application/json', 'X-Wavehaus': '1'}
    if cookie:
        headers['Cookie'] = cookie
    request = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(request)
    except urllib.error.HTTPError as error:
        response = error
    content = response.read()
    return response.status, json.loads(content) if content else None, response.headers.get('Set-Cookie', '').split(';')[0]

def overwrite():
    with zipfile.ZipFile(archive) as package:
        package.extractall(stage)

try:
    process, log, base = start(data)
    try:
        password = 'A preserved release test passphrase!'
        status, setup, cookie = call(base, '/api/setup', 'POST', {'username': 'release_tester', 'password': password, 'serverName': 'Before update', 'deviceLabel': 'Release fixture'})
        assert status == 201 and len(setup['recoveryCodes']) == 10
        assert call(base, '/api/admin/settings', 'PATCH', {'server_name': 'Preserved library', 'member_quota_bytes': 123456789}, cookie)[0] == 200
        state = {'queue': [], 'index': 0, 'positionMs': 12345, 'autoplay': True}
        assert call(base, '/api/player-state', 'PUT', state, cookie)[0] == 200
        (data / 'media').mkdir()
        fixture = data / 'media' / 'original.wav'
        fixture.write_bytes(b'original-owner-media-unchanged')
        secret = hashlib.sha256((data / 'config.php').read_bytes()).hexdigest()
        with closing(sqlite3.connect(data / 'wavehaus.sqlite', isolation_level=None)) as db:
            owner = db.execute('SELECT id,password_hash FROM users').fetchone()
            assert owner[1] != password
            assert db.execute('SELECT COUNT(*) FROM schema_migrations').fetchone()[0] == 4
        # Force an outdated bcrypt cost, then prove successful login rehashes it.
        weak = subprocess.run([php, *arguments, '-r', "echo password_hash('A preserved release test passphrase!', PASSWORD_BCRYPT, ['cost'=>4]);"], check=True, capture_output=True, text=True).stdout
        with closing(sqlite3.connect(data / 'wavehaus.sqlite', isolation_level=None)) as db:
            db.execute('UPDATE users SET password_hash=?', (weak,))
        assert call(base, '/api/auth/login', 'POST', {'username': 'release_tester', 'password': password, 'deviceLabel': 'Rehash fixture'})[0] == 200
        with closing(sqlite3.connect(data / 'wavehaus.sqlite', isolation_level=None)) as db:
            assert db.execute('SELECT password_hash FROM users').fetchone()[0] != weak
        for _ in range(2):
            overwrite()
            assert call(base, '/api/health')[1]['needsSetup'] is False
            assert call(base, '/api/setup', 'POST', {}, cookie)[0] == 404
            assert call(base, '/api/auth/me', cookie=cookie)[1]['user']['id'] == owner[0]
            settings = call(base, '/api/admin/settings', cookie=cookie)[1]
            assert settings['server_name'] == 'Preserved library' and settings['member_quota_bytes'] == 123456789
            assert call(base, '/api/player-state', cookie=cookie)[1] == state
            assert fixture.read_bytes() == b'original-owner-media-unchanged'
            assert hashlib.sha256((data / 'config.php').read_bytes()).hexdigest() == secret
        for path in ['/lib/bootstrap.php', '/migrations/0001_init.sql', '/.user.ini', '/data-secret/config.php']:
            assert call(base, path)[0] in [403, 404]
        reset = secrets.token_urlsafe(32)
        with open(data / 'config.php', 'a') as config:
            config.write(f"\ndefine('RESET_OWNER', '{reset}');\n")
        def recover(_):
            return call(base, '/api/setup/reset', 'POST', {'resetString': reset, 'newPassword': 'A new release recovery passphrase!'})
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(recover, range(2)))
        assert sorted(r[0] for r in results) == [200, 404]
        assert 'RESET_OWNER' not in (data / 'config.php').read_text()
        assert call(base, '/api/auth/me', cookie=cookie)[0] == 401
    finally:
        process.terminate()
        process.wait(timeout=10)
        log.close()
    process, log, base = start(None)
    try:
        assert call(base, '/api/setup', 'POST', {'username': 'fallback_tester', 'password': 'A fallback fixture passphrase!', 'serverName': 'Fallback', 'deviceLabel': 'Fallback fixture'})[0] == 201
        directories = list(stage.glob('data-*'))
        assert len(directories) == 1 and (directories[0] / '.htaccess').exists()
        for _ in range(2):
            overwrite()
            assert call(base, '/api/health')[1]['needsSetup'] is False
            assert list(stage.glob('data-*')) == directories
            assert call(base, '/' + directories[0].name + '/config.php')[0] in [403, 404]
    finally:
        process.terminate()
        process.wait(timeout=10)
        log.close()
    print('Both ZIPs validated. Two overwrites preserve owner, settings, sessions, secret, media and player state. Password rehash, one-use owner reset, private routing and fallback-directory discovery passed.')
finally:
    assert temporary.is_relative_to(work.resolve()) and temporary != work.resolve()
    shutil.rmtree(temporary)
