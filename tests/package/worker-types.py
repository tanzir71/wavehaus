"""Type-check a detached Worker release, catching imports omitted from its zip."""
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

workspace=Path(__file__).resolve().parents[2]
work=(workspace/'.work').resolve()
work.mkdir(exist_ok=True)
version=json.loads((workspace/'package.json').read_text(encoding='utf-8'))['version']
target=Path(tempfile.mkdtemp(prefix='worker-types-',dir=work)).resolve()
try:
    with zipfile.ZipFile(workspace/'dist'/f'wavehaus-worker-v{version}.zip') as archive:
        for name in archive.namelist():
            if not (target/name).resolve().is_relative_to(target):
                raise RuntimeError('Archive member escapes the extraction directory.')
        archive.extractall(target)
    subprocess.run(['node',str(workspace/'node_modules/typescript/bin/tsc'),'--project',str(target/'server-worker/tsconfig.json'),'--noEmit'],check=True,cwd=target)
    print('Detached Worker archive TypeScript passed.')
finally:
    if target!=work and target.is_relative_to(work):
        shutil.rmtree(target)
