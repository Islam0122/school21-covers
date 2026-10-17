import {
  Document,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  TextWrappingType,
  VerticalPositionRelativeFrom,
} from 'docx';
import { TEMPLATE } from './cover';

const A4_TWIP = { w: 11906, h: 16838 }; // 210 × 297 мм
const A4_PX_W = 794; // 210 мм при 96 dpi — единицы ImageRun

/**
 * DOCX: одна страница A4, книжная, поля 0.
 * Обложка — изображение «за текстом», привязанное к краю страницы,
 * поэтому Word не переносит пустой абзац на вторую страницу.
 * @param {Blob} png
 * @returns {Promise<Blob>}
 */
export async function buildDocx(png) {
  const data = new Uint8Array(await png.arrayBuffer());
  const width = A4_PX_W;
  const height = Math.round((A4_PX_W * TEMPLATE.height) / TEMPLATE.width); // ≈1122 px (A4 = 1122.5)

  const doc = new Document({
    creator: 'Генератор обложек школы №21',
    title: 'Окуучунун иши — обложка',
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_TWIP.w, height: A4_TWIP.h, orientation: PageOrientation.PORTRAIT },
            margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' },
            children: [
              new ImageRun({
                type: 'png',
                data,
                transformation: { width, height },
                altText: { name: 'Обложка', title: 'Обложка', description: 'Титульная обложка ученика' },
                floating: {
                  horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                  verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                  behindDocument: true,
                  allowOverlap: true,
                  lockAnchor: true,
                  wrap: { type: TextWrappingType.NONE },
                },
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
