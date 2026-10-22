"""Copy original Paper design assets and Google font files without modifying them."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import re
import subprocess

root = Path(__file__).resolve().parents[1]
assets = root / 'public' / 'assets'
assets.mkdir(parents=True, exist_ok=True)

def download(url):
    target = assets / url.rsplit('/', 1)[-1]
    subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', url, '-o', str(target)], check=True)
    return target.name

with ThreadPoolExecutor(max_workers=5) as pool:
    for name in pool.map(download, json.loads((root / 'source/assets.json').read_text())):
        print(name)

url = 'https://fonts.googleapis.com/css2?family=Cal+Sans&family=Inter:wght@400;500;600&family=Bitcount:wght@400&display=swap'
css = subprocess.check_output(['curl', '--fail', '--silent', '--show-error', '--location', '-A', 'Mozilla/5.0', url], text=True)
for link in set(re.findall(r'url\((https://[^)]+)\)', css)):
    name = download(link)
    css = css.replace(link, '/assets/' + name)
(assets / 'fonts.css').write_text(css)
