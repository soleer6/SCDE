import sys, json
sys.path.insert(0, sys.argv[1])
import yaml
spec = yaml.safe_load(open(sys.argv[2], encoding='utf-8'))
print(spec['info'].get('title'), spec['info'].get('version'))
print('security schemes:', list(spec.get('components',{}).get('securitySchemes',{}).keys()))
for p, ops in spec['paths'].items():
    for m, op in ops.items():
        if m not in ('get','post','put','patch','delete'): continue
        tags = ','.join(op.get('tags', []))
        req = ''
        rb = op.get('requestBody',{}).get('content',{})
        for ct, c in rb.items():
            ref = c.get('schema',{}).get('$ref','')
            req = f'{ct.split("/")[-1]}:{ref.split("/")[-1]}'; break
        resp = []
        for code, r in op.get('responses',{}).items():
            if str(code).startswith('2'):
                for ct, c in r.get('content',{}).items():
                    s = c.get('schema',{}); resp.append(f"{code}:{s.get('$ref', s.get('type',''))}".replace('#/components/schemas/',''))
                    break
                else: resp.append(str(code))
        print(f"{m.upper():6} {p:70} [{tags}] req={req} resp={' '.join(resp)} | {op.get('summary','')[:70]}")
