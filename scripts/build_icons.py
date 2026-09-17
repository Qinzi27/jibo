#!/usr/bin/env python3
"""Package the approved blond-avatar artwork as web and Android launcher assets.

This performs deterministic resizing and canvas placement only. It does not redraw
the artwork or regenerate exercise illustrations. Requires Pillow at build time.
Android's 108dp canvas reserves its central 66dp for the uncut avatar.
"""
from pathlib import Path
import argparse
import hashlib
import json
from statistics import median

try:
    from PIL import Image, ImageDraw
except ImportError as error:
    raise SystemExit('Pillow is required to package icons; no assets were changed.') from error

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT/'artwork/jibo-blond-master.png')
parser.add_argument('--preview-dir', type=Path, help='Optional local mask previews and dimension/hash evidence')
args = parser.parse_args()
source = Image.open(args.source).convert('RGBA')
if source.width != source.height or source.width < 512:
    raise SystemExit('Expected approved square artwork at least 512 pixels wide.')

# Use the surrounding art's own green so the new padding meets its original edge.
rgb = source.convert('RGB')
edge = []
for n in range(0, source.width, max(1, source.width // 64)):
    edge.extend([rgb.getpixel((n, 0)), rgb.getpixel((n, source.height-1)),
                 rgb.getpixel((0, n)), rgb.getpixel((source.width-1, n))])
background = tuple(round(median(p[c] for p in edge)) for c in range(3))
flat = Image.new('RGBA', source.size, background+(255,))
flat.alpha_composite(source)
resample = Image.Resampling.LANCZOS
assets = ROOT/'web/assets'
drawables = ROOT/'android/app/src/main/res/drawable-nodpi'
drawables.mkdir(parents=True, exist_ok=True)
written = []

def save(image, destination):
    image.save(destination, format='PNG', optimize=True)
    written.append({'path': destination.relative_to(ROOT).as_posix(),
                    'width': image.width, 'height': image.height,
                    'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})

for size in (192, 512):
    save(flat.resize((size, size), resample).convert('RGB'), assets/f'icon-{size}.png')

# Extra breathing room for web launchers that apply a mask to installed PWA icons.
maskable = Image.new('RGBA', (512, 512), background+(255,))
maskable.alpha_composite(flat.resize((400, 400), resample), (56, 56))
save(maskable.convert('RGB'), assets/'icon-maskable-512.png')
save(flat.resize((512, 512), resample).convert('RGB'), drawables/'ic_launcher_avatar.png')

# 4 pixels per dp: outer canvas 108dp, approved artwork entirely inside 66dp.
foreground = Image.new('RGBA', (432, 432))
foreground.alpha_composite(flat.resize((264, 264), resample), (84, 84))
save(foreground, drawables/'ic_launcher_foreground_bitmap.png')
color = '#'+''.join(f'{channel:02x}' for channel in background)
(ROOT/'android/app/src/main/res/values/colors.xml').write_text(
    '<resources><color name="launcher_background">'+color+'</color></resources>\n', encoding='utf-8')

if args.preview_dir:
    args.preview_dir.mkdir(parents=True, exist_ok=True)
    composite = Image.new('RGBA', (432, 432), background+(255,))
    composite.alpha_composite(foreground)
    # Launcher mask viewport covers the central 72dp of the 108dp layer canvas.
    visible = composite.crop((72, 72, 360, 360))
    for shape in ('circle', 'rounded-square'):
        mask = Image.new('L', visible.size)
        draw = ImageDraw.Draw(mask)
        if shape == 'circle':
            draw.ellipse((0, 0, 287, 287), fill=255)
        else:
            draw.rounded_rectangle((0, 0, 287, 287), radius=64, fill=255)
        preview = visible.copy()
        preview.putalpha(mask)
        preview.save(args.preview_dir/f'android-icon-{shape}.png')
    report = {'source': str(args.source.relative_to(ROOT)), 'sourcePixels': list(source.size),
              'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
              'background': color, 'androidCanvasDp': 108, 'androidSafeAreaDp': 66,
              'avatarCanvasBoundsPx': [84, 84, 348, 348], 'outputs': written,
              'verificationLimit': 'Deterministic mask previews, not a real Android launcher.'}
    (args.preview_dir/'icon-verification.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'background': color, 'outputs': written}, indent=2))
