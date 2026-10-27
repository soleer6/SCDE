"""Extract the administration/account operations and referenced components.

Keeps a scoped canonical snapshot in owned paths without editing the shared
frontend inventory or the other worktree. Requires PyYAML, already in bridge env.
"""
import argparse
import hashlib
import json
from pathlib import Path
import yaml

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--revision', required=True)
args = parser.parse_args()
raw = args.source.read_text(encoding='utf-8').replace('\r\n', '\n')
source = yaml.safe_load(raw)
operations = {
    '/api/v1/users/': ['get'], '/api/v1/users/export/': ['get'],
    '/api/v1/organizations/': ['post'], '/api/v1/instances/{instance_pk}/': ['patch'],
    '/api/v1/profile/': ['get', 'patch'], '/api/v1/my-subjects/': ['get'],
    '/api/v1/notifications/': ['get'], '/api/v1/notifications/count/': ['get'],
    '/api/v1/notifications/read/': ['patch'], '/api/v1/search/': ['get'],
}
result = {'openapi': source['openapi'], 'info': source['info'],
    'x-source': {'revision': args.revision, 'sha256_lf': hashlib.sha256(raw.encode()).hexdigest()},
    'paths': {path: {method: source['paths'][path][method] for method in methods} for path, methods in operations.items()},
    'components': {'securitySchemes': source['components']['securitySchemes']}}

def collect(node):
    if isinstance(node, dict):
        ref = node.get('$ref')
        if ref:
            prefix, section, name = ref.rsplit('/', 2)
            assert prefix == '#/components', ref
            components = result['components'].setdefault(section, {})
            if name not in components:
                components[name] = source['components'][section][name]
                collect(components[name])
        for key, value in node.items():
            if key != '$ref': collect(value)
    elif isinstance(node, list):
        for value in node: collect(value)

collect(result['paths'])
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Extracted {sum(map(len, operations.values()))} operations; SHA256 LF {result["x-source"]["sha256_lf"]}')
