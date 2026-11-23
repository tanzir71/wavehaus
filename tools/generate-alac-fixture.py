"""Original 2-second ALAC/M4A tone, using only Python's standard library.

Writes ALAC's documented uncompressed escape packets and an ISO BMFF sample
table. No transcoder, sampled audio, or runtime dependency is involved.
Format reference: https://github.com/macosforge/alac (ALACEncoder.cpp and
ALACMagicCookieDescription.txt). This is a format implementation, not copied
encoder code. The resulting audio belongs to the project's MIT fixtures.
"""
from pathlib import Path
import math
import struct


def atom(kind, data):
    return struct.pack('>I', len(data) + 8) + kind + data


def full(kind, data, flags=0):
    return atom(kind, struct.pack('>I', flags) + data)


def generate():
    rate, total, frame = 44100, 88200, 4096
    packets, durations = [], []
    for offset in range(0, total, frame):
        count = min(frame, total - offset)
        # SCE, instance 0, reserved 12 bits, partial/shift/escape flags.
        bits = '000' + '0000' + '0' * 12 + ('1001' if count != frame else '0001')
        if count != frame:
            bits += f'{count:032b}'
        for n in range(offset, offset + count):
            t = n / rate
            envelope = min(t * 10, 1) * min((2 - t) * 10, 1)
            sample = round(32767 * envelope * (.12 * math.sin(2 * math.pi * 220 * t) + .06 * math.sin(2 * math.pi * 330 * t)))
            bits += f'{sample & 65535:016b}'
        bits += '111'  # End element, then zero padding to the next byte.
        bits += '0' * (-len(bits) % 8)
        packets.append(int(bits, 2).to_bytes(len(bits) // 8, 'big'))
        durations.append(count)
    matrix = struct.pack('>9I', 65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824)
    ftyp = atom(b'ftyp', b'M4A ' + struct.pack('>I', 0) + b'M4A mp42isom')
    mdat = atom(b'mdat', b''.join(packets))
    mvhd = full(b'mvhd', struct.pack('>IIII', 0, 0, rate, total) + struct.pack('>IHH', 65536, 256, 0) + bytes(8) + matrix + bytes(24) + struct.pack('>I', 2))
    tkhd = full(b'tkhd', struct.pack('>IIIII', 0, 0, 1, 0, total) + bytes(8) + struct.pack('>HHHH', 0, 0, 256, 0) + matrix + bytes(8), 7)
    mdhd = full(b'mdhd', struct.pack('>IIIIHH', 0, 0, rate, total, 0x55C4, 0))
    hdlr = full(b'hdlr', bytes(4) + b'soun' + bytes(12) + b'Wavehaus tone\0')
    cookie = struct.pack('>IBBBBBBHIII', frame, 0, 16, 40, 10, 14, 1, 255, max(map(len, packets)), 0, rate)
    sample = atom(b'alac', bytes(6) + struct.pack('>H', 1) + bytes(8) + struct.pack('>HHHHI', 1, 16, 0, 0, rate << 16) + full(b'alac', cookie))
    stsd = full(b'stsd', struct.pack('>I', 1) + sample)
    stts = full(b'stts', struct.pack('>I', len(durations)) + b''.join(struct.pack('>II', 1, n) for n in durations))
    stsc = full(b'stsc', struct.pack('>IIII', 1, 1, len(packets), 1))
    stsz = full(b'stsz', struct.pack('>II', 0, len(packets)) + b''.join(struct.pack('>I', len(packet)) for packet in packets))
    stco = full(b'stco', struct.pack('>II', 1, len(ftyp) + 8))
    stbl = atom(b'stbl', stsd + stts + stsc + stsz + stco)
    dinf = atom(b'dinf', full(b'dref', struct.pack('>I', 1) + full(b'url ', b'', 1)))
    minf = atom(b'minf', full(b'smhd', bytes(4)) + dinf + stbl)
    trak = atom(b'trak', tkhd + atom(b'mdia', mdhd + hdlr + minf))
    tags = b''
    for name, value in [(b'\xa9nam', 'Glass Tone ALAC'), (b'\xa9ART', 'Fixture Artist'), (b'\xa9alb', 'Tagged Album'), (b'\xa9day', '2026'), (b'\xa9cmt', 'Original generated Wavehaus tone; MIT')]:
        tags += atom(name, atom(b'data', struct.pack('>II', 1, 0) + value.encode()))
    meta = full(b'meta', full(b'hdlr', bytes(4) + b'mdir' + bytes(12)) + atom(b'ilst', tags))
    output = Path(__file__).resolve().parents[1] / 'tests/fixtures/library/Fixture Artist/Tagged Album/06 - Glass Tone ALAC.m4a'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(ftyp + mdat + atom(b'moov', mvhd + trak + atom(b'udta', meta)))
    print(f'Generated original ALAC/M4A fixture ({output.stat().st_size} bytes).')


if __name__ == '__main__':
    generate()
