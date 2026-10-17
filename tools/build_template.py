"""
Собирает public/Cover_Template.png из исходного шаблона:

1. Заголовок «СТУДЕНТТИН» → «ОКУУЧУНУН» (tools/replace_title.py).
2. Удаляет напечатанное название школы — строку под логотипом и строку «Мектеп:».
   Название школы («№21 ЖББ мектеби») теперь рисует приложение на Canvas
   тем же шрифтом PT Serif (см. src/lib/cover.js), поэтому его легко поменять.
3. Удаляет старую эмблему и ставит на её место оригинальный логотип школы
   из tools/school21_logo.png (PNG с прозрачностью или JPG/PNG на белом фоне).
   Если файла нет — шаг пропускается и старая эмблема остаётся.

Запуск (нужны Python 3, Pillow, numpy, opencv-python):
    python3 tools/build_template.py
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import replace_title  # noqa: E402

ROOT = replace_title.ROOT
DST = replace_title.DST
LOGO = os.path.join(ROOT, 'tools', 'school21_logo.png')

# Геометрия на оригинале (пиксели 1087 × 1536)
# Строки с названием школы: (y0, y1, x0, x1) — полоса удаления, не задевая логотип и черту
HEADER_BAND = (455, 506, 195, 895)  # под логотипом, крупно; за ним — бледное здание
# «Мектеп:» — над чертой y = 900. Фон белый и однородный по горизонтали, поэтому каждая
# строка полосы заливается фоном той же строки справа от текста (x = REF_X0..REF_X1)
FIELD_BAND = (856, 898, 350, 805)
REF_X0, REF_X1 = 810, 915
# Старая эмблема: круг
EMBLEM_CX, EMBLEM_CY, EMBLEM_R = 543.5, 246.5, 201
LOGO_DIAMETER = 406  # чуть больше старой, чтобы край новой полностью её перекрыл
SS = 4  # суперсэмплинг для гладкого края круга


def inpaint(img, mask, radius=7):
    a = np.asarray(img)
    out = cv2.inpaint(a[:, :, ::-1].copy(), mask, radius, cv2.INPAINT_TELEA)[:, :, ::-1].astype(float)
    # лёгкое «зерно», чтобы залитая зона не выглядела пластиковой
    rng = np.random.default_rng(21)
    noise = rng.normal(0, 0.6, out.shape[:2])[:, :, None]
    out = np.where((mask > 0)[:, :, None], out + noise, out)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def erase_school_text(img):
    # строка под логотипом: инпейнтинг только по буквам, чтобы сохранить рисунок здания
    a = np.asarray(img).astype(float)
    y0, y1, x0, x1 = HEADER_BAND
    band = a[y0:y1, x0:x1].mean(2)
    mask = np.zeros(a.shape[:2], np.uint8)
    # буквы и их сглаженный край — всё, что заметно темнее фона
    mask[y0:y1, x0:x1] = ((np.median(band) - band) > 6).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    clip = np.zeros_like(mask)  # не выходим за полосу
    clip[y0:y1, x0:x1] = 1
    img = inpaint(img, mask * clip)

    # строка «Мектеп:»: построчная заливка фоном
    a = np.asarray(img).astype(float).copy()
    y0, y1, x0, x1 = FIELD_BAND
    row_bg = np.median(a[y0:y1, REF_X0:REF_X1], axis=1)  # (строки, RGB)
    rng = np.random.default_rng(21)
    noise = rng.normal(0, 0.6, (y1 - y0, x1 - x0))[:, :, None]
    a[y0:y1, x0:x1] = row_bg[:, None, :] + noise
    return Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8))


def circle_alpha(size, diameter):
    """Маска круга с гладким краем (суперсэмплинг)."""
    big = size * SS
    yy, xx = np.mgrid[0:big, 0:big]
    c = (big - 1) / 2
    inside = ((xx - c) ** 2 + (yy - c) ** 2) <= (diameter * SS / 2) ** 2
    m = Image.fromarray(inside.astype(np.uint8) * 255).resize((size, size), Image.LANCZOS)
    return np.asarray(m).astype(float) / 255.0


def load_logo():
    """Логотип: квадрат по кругу эмблемы, RGBA с круглой альфой."""
    logo = Image.open(LOGO).convert('RGBA')
    a = np.asarray(logo).astype(float)
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    if alpha.min() > 250:
        # непрозрачная картинка: фон — почти белые пиксели по краям
        content = (rgb.min(2) < 235)
    else:
        content = alpha > 128
    ys, xs = np.where(content)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
    sq = logo.crop(box)  # пропорции 1:1 — эмблема не растягивается
    sq = sq.resize((LOGO_DIAMETER, LOGO_DIAMETER), Image.LANCZOS)
    out = np.asarray(sq).astype(float)
    # обрезаем по кругу на полпикселя внутри, чтобы не тянуть белый ореол фона
    out[:, :, 3] *= circle_alpha(LOGO_DIAMETER, LOGO_DIAMETER - 1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def replace_emblem(img):
    if not os.path.exists(LOGO):
        print('Нет', LOGO, '— старая эмблема оставлена без изменений.')
        return img
    # 1) убираем старую эмблему вместе с тенью и восстанавливаем фон здания
    h, w = img.height, img.width
    yy, xx = np.mgrid[0:h, 0:w]
    mask = (((xx - EMBLEM_CX) ** 2 + (yy - EMBLEM_CY) ** 2) <= (EMBLEM_R + 7) ** 2).astype(np.uint8) * 255
    img = inpaint(img, mask, radius=15)
    # 2) ставим новую эмблему точно по центру прежней
    logo = load_logo()
    left = round(EMBLEM_CX - LOGO_DIAMETER / 2)
    top = round(EMBLEM_CY - LOGO_DIAMETER / 2)
    img = img.convert('RGBA')
    img.alpha_composite(logo, (left, top))
    return img.convert('RGB')


def main():
    img = replace_title.load()
    img = replace_title.draw_word(replace_title.erase_line(img), replace_title.NEW_WORD)
    img = erase_school_text(img)
    img = replace_emblem(img)
    img.save(DST, optimize=True)
    print('Готово:', DST)


if __name__ == '__main__':
    main()
