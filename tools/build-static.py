"""Publish only explicit public frontend assets; never backend source or data."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs'
FILES = ['index.html', 'iphone/index.html', 'styles.css', 'appearance.css', 'modern.css', 'modern-plan.css', 'modern-help.css', 'theme.js', 'icons.js', 'i18n.js', 'app.js', 'sync.js', 'runtime-config.js', 'manifest.webmanifest', 'sw.js']

def build():
    DEST.mkdir(exist_ok=True)
    for name in FILES:
        target = DEST / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    for name in ['assets', 'modules']:
        shutil.copytree(ROOT / name, DEST / name, dirs_exist_ok=True)
    (DEST / '.nojekyll').write_text('')
    print('Prepared public frontend in docs/')

if __name__ == '__main__':
    build()
