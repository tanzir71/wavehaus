"""Optional maintenance tool. Generates original tones, never copies music.
Requires NumPy + SoundFile/libsndfile locally; neither is a build/runtime dep.
"""
from pathlib import Path
import struct
import zlib
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[1] / 'tests' / 'fixtures' / 'library'
rate = 44100
t = np.arange(rate * 2, dtype=np.float64) / rate
tone = (.12 * np.sin(2 * np.pi * 220 * t) + .06 * np.sin(2 * np.pi * 330 * t)) * np.minimum(t * 10, 1) * np.minimum((2 - t) * 10, 1)

def write(path, format, subtype, tags=None):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    with sf.SoundFile(target, mode='w', samplerate=rate, channels=1, format=format, subtype=subtype) as file:
        for key, value in (tags or {}).items():
            setattr(file, key, value)
        file.write(tone)

tags = {'title': 'Glass Tone', 'artist': 'Fixture Artist', 'album': 'Tagged Album', 'date': '2026', 'tracknumber': '1', 'genre': 'Generated tones', 'copyright': 'Original Wavehaus test tone; MIT', 'comment': 'Generated from sine waves, no sampled music.'}
write('Fixture Artist/Tagged Album/01 - Glass Tone.flac', 'FLAC', 'PCM_16', tags)
write('Fixture Artist/Tagged Album/02 - Glass Tone.wav', 'WAV', 'PCM_16', {**tags, 'tracknumber': '2'})
write('Fixture Artist/Tagged Album/03 - Glass Tone.mp3', 'MP3', 'MPEG_LAYER_III', {**tags, 'tracknumber': '3'})
write('Fixture Artist/Tagged Album/04 - Glass Tone.ogg', 'OGG', 'VORBIS', {**tags, 'tracknumber': '4'})
write('Fixture Artist/Tagged Album/05 - Glass Tone.aiff', 'AIFF', 'PCM_16', {**tags, 'tracknumber': '5'})
write('Loose tracks/sample_artist - 03 - NIGHT_FERRY [Official Audio] (1).mp3', 'MP3', 'MPEG_LAYER_III')
write('Folder Artist/Folder Album/Disc 2/201 Intro.ogg', 'OGG', 'VORBIS')
write('Phone/Recording 12.wav', 'WAV', 'PCM_16')
(root / 'Fixture Artist/Tagged Album/01 - Glass Tone.lrc').write_text('[00:00.00]An original generated tone\n[00:01.00]A second, then home\n', encoding='utf-8')

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

rows = bytearray()
for y in range(600):
    rows.append(0)
    for x in range(600):
        bar = 90 <= x < 510 and (x - 90) % 35 < 20 and abs(y - 276) < 25 + ((x // 35 * 19) % 100)
        rows.extend((79, 99, 100) if bar else (15, 42, 44))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 600, 600, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
(root / 'Fixture Artist/Tagged Album/cover.png').write_bytes(png)
print(f'Generated original fixtures with SoundFile {sf.__version__} / NumPy {np.__version__}.')
