"""Static checks for the LaTeX skeleton (no LaTeX distribution needed).

Usage: python docs/memoria/check_tex.py
Checks: included files exist, braces balanced, \\ref/\\cref targets defined,
acronyms (\\ac*) and definitions (\\dfn*) declared.
"""
import pathlib
import re

root = pathlib.Path(__file__).parent
main = (root / 'main.tex').read_text(encoding='utf-8')
texs = list(root.rglob('*.tex'))
errors = 0

refs = re.findall(r'\{((?:chapters|appendices|front-matter)/[^}]+)\}', main)
missing = [r for r in refs if not (root / (r + '.tex')).exists()]
print(f'included files: {len(refs)}, missing: {missing}')
errors += len(missing)

for p in texs:
    s = re.sub(r'\\[{}%]', '', p.read_text(encoding='utf-8'))
    s = '\n'.join(line.split('%')[0] for line in s.splitlines())
    if s.count('{') != s.count('}'):
        print(f'unbalanced braces: {p.relative_to(root)} {s.count("{")}/{s.count("}")}')
        errors += 1

labels = set()
for p in texs:
    labels |= set(re.findall(r'\\label\{([^}]+)\}', p.read_text(encoding='utf-8')))
used = set()
for p in texs:
    for grp in re.findall(r'\\[cC]?ref\{([^}]+)\}', p.read_text(encoding='utf-8')):
        used |= {x.strip() for x in grp.split(',')}
undefined = sorted(used - labels)
print(f'labels: {len(labels)}, referenced: {len(used)}, undefined: {undefined}')
errors += len(undefined)

acr = set(re.findall(r'\\newacronym\{([^}]+)\}', (root / 'preamble/acronyms.tex').read_text(encoding='utf-8')))
dfn = set(re.findall(r'\\newdefinition\{([^}]+)\}', (root / 'preamble/definitions.tex').read_text(encoding='utf-8')))
ua, ud = set(), set()
for p in texs:
    t = p.read_text(encoding='utf-8')
    ua |= set(re.findall(r'\\ac[sl]?p?\{([^}]+)\}', t))
    ud |= set(re.findall(r'\\dfn(?:pl)?\{([^}]+)\}', t))
print(f'undefined acronyms: {sorted(ua - acr)}; undefined definitions: {sorted(ud - dfn)}')
errors += len(ua - acr) + len(ud - dfn)

pending = sum(t.count('\\pendiente{') for t in (p.read_text(encoding='utf-8') for p in texs))
print(f'\\pendiente marks: {pending}')
raise SystemExit(1 if errors else 0)
