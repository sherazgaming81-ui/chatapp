import json, os, base64

ROOT = os.path.expanduser('~/workspace/whatsapp-chat')
EXCLUDE_DIRS = {'node_modules', '.next', '.git'}
EXCLUDE_FILES = {'package-lock.json', 'AGENTS.md', 'eslint.config.mjs', 'next-env.d.ts', 'tsconfig.tsbuildinfo'}
DEPLOY_EXCLUDE = {'README.md', 'firestore.rules', 'storage.rules', 'supabase-schema.sql', 'supabase-schema-v1.sql', 'prep_deploy.py',
                  '.env.example', 'app/favicon.ico', 'public/next.svg', 'public/vercel.svg',
                  'public/globe.svg', 'public/window.svg', 'public/file.svg'}
TEXT_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.md', '.rules', '.example', '.txt', '.svg'}

files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
    for fn in filenames:
        if fn in EXCLUDE_FILES:
            continue
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, ROOT)
        if rel in DEPLOY_EXCLUDE or rel == '.gitignore':
            continue
        with open(full, 'rb') as f:
            raw = f.read()
        ext = os.path.splitext(fn)[1].lower()
        if ext in TEXT_EXTS or fn.startswith('.env'):
            files.append({'file': rel, 'data': raw.decode('utf-8'), 'encoding': 'utf-8'})
        else:
            files.append({'file': rel, 'data': base64.b64encode(raw).decode(), 'encoding': 'base64'})

files.sort(key=lambda x: x['file'])
args = {
    'requestBody': {
        'name': 'chat',
        'target': 'production',
        'projectSettings': {'framework': 'nextjs'},
        'files': files,
    }
}
os.makedirs('/tmp/wadeploy', exist_ok=True)
with open('/tmp/wadeploy/deploy_args.json', 'w') as f:
    json.dump(args, f)
print(f'files: {len(files)}, args bytes: {os.path.getsize("/tmp/wadeploy/deploy_args.json")}')
