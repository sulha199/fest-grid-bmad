"""Token-level 3-way merge of each conflict hunk of a diff3-style conflicted file.
usage: tokmerge.py file spec   spec = comma list per hunk: tok | ours | theirs | both | bothr | base | keep"""
import sys, re, subprocess, tempfile, os

NL = '\u0001'
f = sys.argv[1]
spec = sys.argv[2].split(',')
t = open(f, encoding='utf-8', newline='').read().split('\n')


def tok(lines):
    return re.findall(r'\s+|\S+', '\n'.join(lines))


out = []
i = 0
n = 0
report = []
while i < len(t):
    if t[i].startswith('<<<<<<<'):
        start = i
        a = []
        bs = []
        b = []
        i += 1
        while not t[i].startswith('|||||||'):
            a.append(t[i]); i += 1
        i += 1
        while not t[i].startswith('======='):
            bs.append(t[i]); i += 1
        i += 1
        while not t[i].startswith('>>>>>>>'):
            b.append(t[i]); i += 1
        c = spec[n]
        n += 1
        if c == 'tok':
            d = tempfile.mkdtemp()
            paths = []
            for nm, x in (('a', a), ('b', bs), ('c', b)):
                p = os.path.join(d, nm)
                with open(p, 'w', encoding='utf-8', newline='') as fh:
                    fh.write('\n'.join(y.replace('\n', NL) for y in tok(x)) + '\n')
                paths.append(p)
            r = subprocess.run(['git', 'merge-file', '-p', '-L', 'ours', '-L', 'base', '-L', 'theirs'] + paths, capture_output=True)
            res = r.stdout.decode('utf-8')
            parts = res.split('\n')
            if parts and parts[-1] == '':
                parts.pop()
            merged = ''.join(parts).replace(NL, '\n')
            report.append((n, 'tok', 'conflicts=%d' % r.returncode))
            out += merged.split('\n')
        elif c == 'keep':
            out += t[start:i + 1]
            report.append((n, 'keep'))
        else:
            out += {'ours': a, 'theirs': b, 'both': a + b, 'bothr': b + a, 'base': bs}[c]
            report.append((n, c))
    else:
        out.append(t[i])
    i += 1
with open(f, 'w', encoding='utf-8', newline='') as fh:
    fh.write('\n'.join(out))
print(report)
