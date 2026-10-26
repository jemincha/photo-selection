"""Render the repository's simple card/heart mark without external images or fonts."""
from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
size = 2048
canvas = Image.new('RGB', (size, size), '#F5EEE4')
back = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(back)
draw.rounded_rectangle((470, 390, 1500, 1600), radius=130, fill='#C2CBBE')
canvas.paste(back.rotate(13, resample=Image.Resampling.BICUBIC), (0, 0), back.rotate(13, resample=Image.Resampling.BICUBIC))
front = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(front)
draw.rounded_rectangle((515, 420, 1545, 1630), radius=130, fill='#FFFFFF')
draw.rounded_rectangle((610, 515, 1450, 1370), radius=70, fill='#EEDBD0')
points = []
for step in range(500):
    t = 2*pi*step/500
    x = 16*sin(t)**3
    y = 13*cos(t)-5*cos(2*t)-2*cos(3*t)-cos(4*t)
    points.append((1030+x*17, 950-y*17))
draw.polygon(points, fill='#9A5742')
draw.rounded_rectangle((870, 1480, 1190, 1510), radius=15, fill='#C7CFC1')
front = front.rotate(-8, resample=Image.Resampling.BICUBIC)
canvas.paste(front, (0, 0), front)
icon = canvas.resize((1024, 1024), Image.Resampling.LANCZOS)
assert icon.mode == 'RGB' and icon.size == (1024, 1024)
icon.save(root/'mobile/assets/icon.png')
icon.resize((64, 64), Image.Resampling.LANCZOS).save(root/'mobile/assets/favicon.png')
print('Rendered opaque 1024px app icon and 64px favicon.')
