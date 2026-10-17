"""
Заменяет первую строку заголовка на шаблоне обложки:
«СТУДЕНТТИН» → «ОКУУЧУНУН». Строка «ИШИ», зелёная табличка, золотая рамка
и все остальные элементы остаются пикселями оригинала.

Запуск (нужны Python 3, Pillow, numpy, opencv-python):
    python3 tools/replace_title.py
Читает tools/Cover_Template_original.png, пишет public/Cover_Template.png.

Как это работает:
1. Маска старой строки (белые буквы + их светлое свечение) удаляется инпейнтингом
   по однотонному зелёному фону таблички.
2. Новое слово рисуется шрифтом Liberation Serif Bold (метрический аналог Times New Roman Bold),
   подогнанным под оригинал: та же высота заглавных (72 px), базовая линия, сжатие по ширине,
   толщина штриха, цвет и свечение. Параметры откалиброваны повторной отрисовкой
   «СТУДЕНТТИН» и сравнением с оригиналом (см. calibrate()).
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'Cover_Template_original.png')
DST = os.path.join(ROOT, 'public', 'Cover_Template.png')
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'

NEW_WORD = 'ОКУУЧУНУН'
OLD_WORD = 'СТУДЕНТТИН'

# Геометрия первой строки на оригинале (пиксели 1087 × 1536)
LINE_X0, LINE_X1 = 186, 916  # горизонтальные границы букв
CENTER_X = (LINE_X0 + LINE_X1) / 2
CAP_TOP, BASELINE = 587, 659  # верх заглавных и базовая линия → высота 72 px
ERASE_Y0, ERASE_Y1 = 572, 679  # полоса удаления (выше — край таблички, ниже — «ИШИ»)
ERASE_X0, ERASE_X1 = 168, 934  # внутри золотой рамки

TEXT_RGB = (246, 251, 249)
SS = 4  # суперсэмплинг для сглаживания

# xscale, tracking и свечение — из calibrate(); stroke подобран по толщине стеблей
# (оригинал 18–20 px, Liberation без обводки ≈16 px)
DEFAULTS = dict(xscale=0.93, stroke=1.0, tracking=1.0, glow_radius=3.0, glow_alpha=0.10)


def load():
    if not os.path.exists(SRC):
        sys.exit(f'Нет исходного шаблона: {SRC}')
    return Image.open(SRC).convert('RGB')


def erase_line(img):
    a = np.asarray(img).copy()
    L = a.mean(2)
    bg_l = np.median(L[560:578, 200:900])
    band = np.zeros(L.shape, bool)
    band[ERASE_Y0:ERASE_Y1, ERASE_X0:ERASE_X1] = True
    # всё, что заметно отличается от фона в полосе: буквы, свечение и тёмная кромка
    text = (np.abs(L - bg_l) > 2.5) & band
    mask = cv2.dilate(text.astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
    mask[~band] = 0
    out = cv2.inpaint(a[:, :, ::-1], mask, 9, cv2.INPAINT_TELEA)[:, :, ::-1].astype(float)
    # возвращаем лёгкое «зерно» фона, чтобы залитая зона не выглядела пластиковой
    rng = np.random.default_rng(21)
    noise = rng.normal(0, 0.75, out.shape[:2])[:, :, None]
    m = (mask > 0)[:, :, None]
    out = np.where(m, out + noise, out)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def text_mask(word, size_hint, p):
    """Маска слова в координатах шаблона (float 0..1)."""
    font = ImageFont.truetype(FONT, 100)
    bb = font.getbbox('Н')
    cap = (BASELINE - CAP_TOP) - 2 * p['stroke']  # обводка добавляет высоту сверху и снизу
    size = 100 * cap / (bb[3] - bb[1])  # подгон высоты заглавных
    font = ImageFont.truetype(FONT, round(size * SS))
    adv = [font.getlength(ch) for ch in word]
    track = p['tracking'] * SS / p['xscale']
    total = sum(adv) + track * (len(word) - 1)
    W, H = int(total + 200 * SS), int(200 * SS)
    canvas = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(canvas)
    x = 100 * SS
    base = 150 * SS
    for ch, w in zip(word, adv):
        d.text((x, base), ch, font=font, fill=255, anchor='ls',
               stroke_width=int(round(p['stroke'] * SS)), stroke_fill=255)
        x += w + track
    # горизонтальное сжатие и уменьшение до 1×
    m = np.asarray(canvas)
    xs = np.where(m.any(0))[0]
    crop = canvas.crop((xs.min(), 0, xs.max() + 1, H))
    new_w = max(1, round(crop.width * p['xscale'] / SS))
    crop = crop.resize((new_w, H // SS), Image.LANCZOS)
    full = Image.new('L', (1087, 1536), 0)
    left = round(CENTER_X - new_w / 2)
    full.paste(crop, (left, BASELINE - 150))
    return np.asarray(full).astype(float) / 255.0


def draw_word(bg, word, p=DEFAULTS):
    m = text_mask(word, None, p)
    base = np.asarray(bg).astype(float)
    glow = np.asarray(Image.fromarray((m * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(p['glow_radius']))).astype(float) / 255.0
    white = np.array(TEXT_RGB, float)
    out = base + (255 - base) * (glow * p['glow_alpha'])[:, :, None]
    out = out * (1 - m[:, :, None]) + white * m[:, :, None]
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8))


def score(orig, test):
    a = np.asarray(orig).astype(float)[ERASE_Y0:ERASE_Y1, ERASE_X0:ERASE_X1]
    b = np.asarray(test).astype(float)[ERASE_Y0:ERASE_Y1, ERASE_X0:ERASE_X1]
    return np.abs(a - b).mean()


def calibrate():
    orig = load()
    bg = erase_line(orig)
    best = None
    for xs in np.arange(0.90, 0.985, 0.01):
        for st in (0.0, 0.3, 0.6, 0.9, 1.2):
            for tr in (-2, -1, 0, 1, 2, 3):
                p = dict(DEFAULTS, xscale=xs, stroke=st, tracking=tr)
                s = score(orig, draw_word(bg, OLD_WORD, p))
                if best is None or s < best[0]:
                    best = (s, p)
    for gr in (3.0, 4.0, 5.0, 6.0, 8.0):
        for ga in (0.0, 0.05, 0.10, 0.15, 0.2):
            p = dict(best[1], glow_radius=gr, glow_alpha=ga)
            s = score(orig, draw_word(bg, OLD_WORD, p))
            if s < best[0]:
                best = (s, p)
    print('лучшие параметры:', {k: round(float(v), 3) for k, v in best[1].items()}, 'ошибка', round(best[0], 3))
    return best[1]


def main():
    params = calibrate() if '--calibrate' in sys.argv else DEFAULTS
    orig = load()
    bg = erase_line(orig)
    if '--check' in sys.argv:
        draw_word(bg, OLD_WORD, params).save(os.path.join(ROOT, 'tools', 'check_old_word.png'))
    draw_word(bg, NEW_WORD, params).save(DST, optimize=True)
    print('Готово:', DST)


if __name__ == '__main__':
    main()
