"""Assembles the game into one HTML fragment: the shell with the stylesheet and both scripts inlined.

python3 _tools/drone-season/build/build.py [out.html]

Writes _tools/drone-season/drone-season.html by default. That fragment is what gets published
as the Claude artifact (the artifact viewer supplies the <html>/<head> skeleton). site.py wraps
the same fragment into the full page for michaelchapman.me/drone-season/.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # this _tools/drone-season folder
SRC = os.path.join(ROOT, 'src')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def fragment():
    out = read('shell.html')
    for marker, names in (('/*__CSS__*/', ['style.css']), ('/*__SIM__*/', ['sim.js', 'campaign.js']), ('/*__GAME__*/', ['game.js'])):
        assert out.count(marker) == 1, marker
        out = out.replace(marker, '\n'.join(read(n) for n in names))
    return out


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'drone-season.html')
    page = fragment()
    with open(path, 'w', encoding='utf-8') as f:
        f.write(page)
    print('built', path, len(page), 'bytes')
