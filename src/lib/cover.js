/**
 * Рисование обложки на Canvas.
 * Шаблон public/Cover_Template.png (собирается tools/build_template.py) используется как фон —
 * поверх него вписываются название школы (под логотипом и в строке «Мектеп:»),
 * ФИО, класс и учебный год.
 *
 * Координаты измерены по пикселям исходного изображения 1087 × 1536.
 */
export const SCHOOL = '№21 ЖББ мектеби';

export const TEMPLATE = {
  url: `${import.meta.env.BASE_URL}Cover_Template.png`,
  width: 1087,
  height: 1536,
  textX: 357, // левый край текста = начало напечатанного «№21 …»
  lineRight: 921, // правый край линий
  baselineAboveLine: 14, // базовая линия текста над чертой
  lines: { school: 900, fullName: 967, className: 1028, year: 1089 },
  // Название школы под логотипом: по центру, тем же шрифтом и цветом, что был в оригинале
  // (размер подобран по ширине прежней строки «№21 Жалпы билим берүү мектеби»: 207…882 px)
  header: { centerX: 545, baseline: 493, color: '#18372e', fontSize: 42 },
  textColor: '#1f2e2b',
  fontFamily: '"PT Serif", "Times New Roman", serif',
  baseFontSize: 26.5, // совпадает по ширине с напечатанной строкой школы
  minFontSize: 12,
};

/** Итоговый PNG: 2174 × 3072 px */
export const EXPORT_SCALE = 2;

let templatePromise = null;

/** Шаблон загружается один раз и переиспользуется для всех учеников. */
export function loadTemplate() {
  if (!templatePromise) {
    templatePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        templatePromise = null;
        reject(new Error('Не найден шаблон public/Cover_Template.png. Положите файл в папку public и перезапустите.'));
      };
      img.src = TEMPLATE.url;
    });
  }
  return templatePromise;
}

let fontPromise = null;

/** Ждём PT Serif (кириллица, ү ң ө, №), иначе Canvas нарисует запасным шрифтом. */
export function loadFonts() {
  if (!fontPromise) {
    fontPromise = document.fonts
      .load(`${TEMPLATE.baseFontSize}px "PT Serif"`, 'АаЖжБҮүҢңӨө№0123456789–-')
      .then((faces) => {
        if (!faces.length) throw new Error('Шрифт PT Serif не загрузился.');
      })
      .catch((e) => {
        fontPromise = null;
        throw e;
      });
  }
  return fontPromise;
}

/** Уменьшает шрифт, пока текст не поместится на линию. */
function fitFontSize(ctx, text, maxWidth, scale) {
  let size = TEMPLATE.baseFontSize;
  while (size > TEMPLATE.minFontSize) {
    ctx.font = `${size * scale}px ${TEMPLATE.fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth * scale) return size;
    size -= 0.5;
  }
  return TEMPLATE.minFontSize;
}

function drawOnLine(ctx, text, lineY, scale) {
  const value = (text || '').trim();
  if (!value) return;
  const maxWidth = TEMPLATE.lineRight - TEMPLATE.textX - 4;
  const size = fitFontSize(ctx, value, maxWidth, scale);
  const x = TEMPLATE.textX * scale;
  const y = (lineY - TEMPLATE.baselineAboveLine) * scale;

  ctx.save();
  ctx.font = `${size * scale}px ${TEMPLATE.fontFamily}`;
  ctx.fillStyle = TEMPLATE.textColor;
  ctx.strokeStyle = TEMPLATE.textColor;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // Текст на фото чуть плотнее и мягче векторного шрифта — выравниваем визуально
  ctx.filter = `blur(${0.3 * scale}px)`;
  ctx.lineWidth = 0.45 * scale;
  ctx.lineJoin = 'round';
  ctx.fillText(value, x, y, maxWidth * scale); // maxWidth — страховка от выхода за линию
  ctx.strokeText(value, x, y, maxWidth * scale);
  ctx.restore();
}

function drawHeader(ctx, text, scale) {
  const { centerX, baseline, color, fontSize } = TEMPLATE.header;
  ctx.save();
  ctx.font = `${fontSize * scale}px ${TEMPLATE.fontFamily}`;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // центрируем по видимым границам букв, как было напечатано на шаблоне
  const m = ctx.measureText(text);
  const x = centerX * scale - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  ctx.filter = `blur(${0.3 * scale}px)`;
  ctx.lineWidth = 0.45 * scale;
  ctx.lineJoin = 'round';
  ctx.fillText(text, x, baseline * scale);
  ctx.strokeText(text, x, baseline * scale);
  ctx.restore();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{fullName: string, className: string, year: string}} data
 * @param {number} scale 1 — предпросмотр, 2 — экспорт 2174 × 3072
 */
export async function renderCover(canvas, data, scale = 1) {
  const [img] = await Promise.all([loadTemplate(), loadFonts()]);
  canvas.width = Math.round(TEMPLATE.width * scale);
  canvas.height = Math.round(TEMPLATE.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не поддерживает Canvas.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  drawHeader(ctx, SCHOOL, scale);
  drawOnLine(ctx, SCHOOL, TEMPLATE.lines.school, scale);
  drawOnLine(ctx, data.fullName, TEMPLATE.lines.fullName, scale);
  drawOnLine(ctx, data.className, TEMPLATE.lines.className, scale);
  drawOnLine(ctx, data.year, TEMPLATE.lines.year, scale);
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сформировать PNG.'))), 'image/png');
  });
}
