"""Publish only explicit public frontend assets; never backend source or data."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs'
FILES = ['index.html', 'styles.css', 'appearance.css', 'theme.js', 'icons.js', 'i18n.js', 'app.js', 'sync.js', 'runtime-config.js', 'manifest.webmanifest', 'sw.js']

def build():
    DEST.mkdir(exist_ok=True)
    for name in FILES:
        shutil.copy2(ROOT / name, DEST / name)
    for name in ['assets', 'modules']:
        shutil.copytree(ROOT / name, DEST / name, dirs_exist_ok=True)
    (DEST / '.nojekyll').write_text('')
    print('Prepared public frontend in docs/')

if __name__ == '__main__':
    build()
