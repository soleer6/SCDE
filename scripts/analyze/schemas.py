import sys
sys.path.insert(0, sys.argv[1])
import yaml
spec = yaml.safe_load(open(sys.argv[2], encoding='utf-8'))
S = spec['components']['schemas']
def fmt(s):
    if '$ref' in s: return s['$ref'].split('/')[-1]
    if 'allOf' in s: return '|'.join(fmt(x) for x in s['allOf'])
    if 'oneOf' in s: return 'oneOf(' + '|'.join(fmt(x) for x in s['oneOf']) + ')'
    t = s.get('type','?')
    if t == 'array': return f"[{fmt(s.get('items',{}))}]"
    if 'enum' in s: return 'enum' + str(s['enum'])
    f = s.get('format'); n = '?' if s.get('nullable') else ''
    return f"{t}{'('+f+')' if f else ''}{n}"
for name in sys.argv[3:]:
    s = S.get(name)
    if not s: print('MISSING', name); continue
    req = set(s.get('required', []))
    if 'enum' in s: print(f"{name}: enum {s['enum']}"); continue
    print(f"{name}:")
    for k, v in s.get('properties', {}).items():
        ro = ' ro' if v.get('readOnly') else ''
        print(f"   {'*' if k in req else ' '}{k}: {fmt(v)}{ro}")
