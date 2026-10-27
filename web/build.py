"""Builds the single-file game: template + bundled three.js + game sources.
Usage: python3 build.py [--out path/to/index.html]"""
import glob, os, sys
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'dist', 'netcord.html')
if '--out' in sys.argv: out = os.path.abspath(sys.argv[sys.argv.index('--out') + 1])
tpl = open(os.path.join(here, 'src', 'template.html'), encoding='utf-8').read()
three = open(os.path.join(here, 'build', 'three.min.js'), encoding='utf-8').read()
src = ''.join(open(f, encoding='utf-8').read() + '\n' for f in sorted(glob.glob(os.path.join(here, 'src', '[0-9]-*.js'))))
html = tpl.replace('<!--SCRIPTS-->', '<script>/* three.js r186, MIT License, bundled for offline play */\n' + three + '\n</script>\n<script>\n' + src + '</script>')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(len(html) // 1024, 'KB ->', out)
