"""Package the single runtime and data levels; fingerprint runtime assets for Pages."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1] if len(sys.argv) > 1 else root / '_site')
# Never erase or silently reuse an existing output directory.
target.mkdir(parents=True, exist_ok=False)
(target / 'game').mkdir()
(target / 'levels').mkdir()

def asset(name, content):
    path = Path(name)
    filename = path.stem + '.' + hashlib.sha256(content.encode()).hexdigest()[:12] + path.suffix
    (target / 'game' / filename).write_text(content)
    return filename

engine = asset('engine.mjs', (root / 'game/engine.mjs').read_text())
app_text = (root / 'game/app.mjs').read_text().replace('./engine.mjs?v=shared-1', './' + engine)
app = asset('app.mjs', app_text)
style = asset('style.css', (root / 'game/style.css').read_text())
html = (root / 'game/index.html').read_text().replace('app.mjs?v=shared-1', app).replace('style.css?v=shared-1', style)
(target / 'game/index.html').write_text(html)
for name in ['index.html', 'level-1/index.html', 'game-whitebox/index.html']:
    (target / name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / name, target / name)
catalog = json.loads((root / 'levels/index.json').read_text())
shutil.copyfile(root / 'levels/index.json', target / 'levels/index.json')
for entry in catalog:
    name = entry['id']
    if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in name):
        raise ValueError('Invalid level id')
    shutil.copyfile(root / 'levels' / (name + '.json'), target / 'levels' / (name + '.json'))
(target / '.nojekyll').touch()
print('Packaged one engine, one app and', len(catalog), 'data-only levels:', target)
