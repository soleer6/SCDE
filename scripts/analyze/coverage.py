"""API coverage: which backend operations are called by the frontend.

Usage: python scripts/analyze/coverage.py docs/frontend/API_INVENTORY.md src/features [--md]
Heuristic (deterministic): an operation counts as covered when its path pattern
appears in a non-mock, non-test source file next to an api.<method>( call of the
same HTTP method (api.upload(path, form, 'PUT') counts as PUT; a bare
request(path, { method }) call counts for its method). Path params match any
`${...}` expression or literal segment.
"""
import pathlib
import re
import sys

inv, src = sys.argv[1], sys.argv[2]
md = '--md' in sys.argv
ops = []
for line in open(inv, encoding='utf-8', errors='replace'):
    m = re.match(r'^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)\s+\[([^\]]*)\]', line)
    if m and not m.group(2).startswith('/health'):
        ops.append((m.group(1), m.group(2), m.group(3)))

files = [p for p in pathlib.Path(src).rglob('*.js*') if 'mock' not in p.name and '.test.' not in p.name]
code = '\n'.join(p.read_text(encoding='utf-8') for p in files)
# Normalise helper-built prefixes used in the code base, e.g. `${root(id)}` == `/subjects/${id}`
code = re.sub(r'\$\{root\([^)]*\)\}', '/subjects/${x}', code)

METHOD = {'GET': r'get|blob', 'POST': r'post|upload', 'PUT': r'put', 'PATCH': r'patch', 'DELETE': r'del'}


def pattern(path):
    parts = []
    for seg in path.strip('/').split('/'):
        parts.append(r'(\$\{[^}]+\}|[A-Za-z0-9_.-]+)' if seg.startswith('{') else re.escape(seg))
    return r'/' + r'/'.join(parts) + r'/'


covered, missing = [], []
for method, path, tag in ops:
    q = r'[`\'"]'
    rx = re.compile(r'api\.(' + METHOD[method] + r')\(\s*' + q + pattern(path) + r'[`\'"?]')
    # api.upload(path, form, 'PUT') is a PUT, not a POST
    put = re.compile(r'api\.upload\(\s*' + q + pattern(path) + q + r'[^)\n]*' + q + r'PUT' + q)
    # bare request(path, { method: 'X', ... })
    req = re.compile(r'request\(\s*' + q + pattern(path) + q + r'\s*,\s*\{[^}]*method:\s*' + q + method + q)
    hit = rx.search(code) or req.search(code)
    if method == 'PUT':
        hit = hit or put.search(code)
    elif method == 'POST' and hit and put.search(code) and not re.search(r'api\.post\(\s*' + q + pattern(path), code):
        hit = None
    (covered if hit else missing).append((method, path, tag))

total = len(ops)
print(f'Coverage: {len(covered)}/{total} operations ({100 * len(covered) // total}%)')
by_tag = {}
for method, path, tag in ops:
    c = (method, path, tag) in covered
    by_tag.setdefault(tag, [0, 0])
    by_tag[tag][0] += c
    by_tag[tag][1] += 1
for tag, (c, t) in sorted(by_tag.items()):
    print(f'  {tag:15} {c}/{t}')
if md or '--missing' in sys.argv:
    print('\nNot covered:')
    for method, path, tag in missing:
        print(f'  {method:6} {path}  [{tag}]')
