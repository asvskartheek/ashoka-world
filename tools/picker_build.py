# Builds picker/img/* (web-sized refs + per-round stills) and picker/data.js from cook/ + VERSIONS.md.
import json, os, re, glob
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'picker', 'img')
def save(src, dst, w, q):
    if os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(src): return
    im = Image.open(src).convert('RGB'); h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(dst, quality=q, optimize=True, progressive=True)
for i in range(1, 5):
    save(f'{R}/cook/refs/R0{i}.png', f'{OUT}/ref_S0{i}.jpg', 1280, 84)
    save(f'{R}/cook/refs/R0{i}.png', f'{OUT}/ref_S0{i}_t.jpg', 320, 75)
notes = {}
for line in open(f'{R}/VERSIONS.md'):
    m = re.match(r'\| v0\.(\d+) \|[^|]*\| (.*) \|$', line.strip())
    if m: notes[int(m.group(1))] = m.group(2)
sc = json.load(open(f'{R}/cook/scores.json'))
rounds = []
for d in sorted(glob.glob(f'{R}/cook/stills/r[0-8][0-9]')):
    n = int(os.path.basename(d)[1:])
    srcs = []
    for s in range(1, 5):
        p = next((f for f in (f'{d}/S0{s}.png', f'{d}/S0{s}.jpg') if os.path.exists(f)), None)
        srcs.append(p)
    if None in srcs: continue
    for s, p in enumerate(srcs, 1):
        save(p, f'{OUT}/r{n:02d}_S0{s}.jpg', 1280, 82)
        save(p, f'{OUT}/r{n:02d}_S0{s}_t.jpg', 320, 72)
    k = sc['rounds'].index(n) if n in sc['rounds'] else None
    g = lambda key: (sc[key][k] + sc['offset']) if k is not None and sc[key][k] is not None else None
    note = re.sub(r'^Cook round \d+: ', '', notes.get(n, ''))
    rounds.append({'n': n, 'overall': g('overall'), 'S01': g('S01'), 'S02': g('S02'), 'S03': g('S03'), 'S04': g('S04'), 'note': note})
open(f'{R}/picker/data.js', 'w').write('window.ROUNDS=' + json.dumps(rounds, indent=1) + ';\n')
print(len(rounds), 'rounds:', [r['n'] for r in rounds])
