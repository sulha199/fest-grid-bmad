"""Renumber the branch's dedup/groups/place/audience PRD refs so they no longer collide with master's Epic 10 (3.18, FR116-FR130, 4.21).
3.18-3.21 -> 3.19-3.22; FR116-FR126 -> FR131-FR141; 4.21 EventGroup -> 4.22.  Run from repo root: py renumber.py <prd-mode|ref-mode> files..."""
import re, sys

mode = sys.argv[1]
files = sys.argv[2:]

FR = re.compile(r'\bFR(11[6-9]|12[0-6])\b')
SEC = re.compile(r'(?<![\d.A-Za-z])3\.(18|19|20|21)(?![\d]|\.\d|[a-z])')
KEY = re.compile(r'PRD|§|Section|Sections')

def sec(m):
    return '3.%d' % (int(m.group(1)) + 1)

total = 0
for f in files:
    with open(f, 'r', encoding='utf-8', newline='') as fh:
        text = fh.read()
    out = []
    changed = 0
    for line in text.split('\n'):
        new = FR.sub(lambda m: 'FR%d' % (int(m.group(1)) + 15), line)
        if mode == 'prd' or KEY.search(line):
            new = SEC.sub(sec, new)
        if mode == 'prd' or 'EventGroup' in new:
            new = re.sub(r'(?<![\d.])4\.21(?=\.? ?EventGroup|\b.{0,40}EventGroup)', '4.22', new) if 'EventGroup' in new else new
        if new != line:
            changed += 1
        out.append(new)
    if changed:
        with open(f, 'w', encoding='utf-8', newline='') as fh:
            fh.write('\n'.join(out))
        print('%4d lines  %s' % (changed, f))
        total += changed
print('total', total)
