import { readAnnotationPayload } from './api.js';
import { isPadAnnotation, parseInk } from './ocr.js';

/** Read in stable server order, independently of download completion order.
 * Each record keeps its own canvas: erasing one layer cannot erase another.
 * The last page-level record by the current author is editable; older records
 * remain visible, including legacy records by that same author. */
export async function readAnnotationLayers(list, authorId = null) {
  const records = await Promise.all(list.filter((a) => !isPadAnnotation(a) && ['TEXT', 'STYLUS'].includes(a.annotation_type)).map(async (a) => {
    const payload = await readAnnotationPayload(a);
    if (a.annotation_type === 'STYLUS') {
      const data = JSON.parse(payload);
      if (!Array.isArray(data) && !Array.isArray(data?.strokes)) throw new Error('INVALID_ANNOTATION_PAYLOAD');
    }
    const strokes = a.annotation_type === 'STYLUS' ? parseInk(payload) : null;
    return { ...a, payload, strokes };
  }));
  records.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
  const ownPages = {};
  let ownText = null;
  for (const a of records) {
    if (a.annotation_type === 'STYLUS' && a.strokes === null) continue; // legacy OCR pad
    if (!authorId || a.author_id !== authorId || a.problem_id) continue;
    if (a.annotation_type === 'STYLUS') ownPages[a.page_number] = a;
    else ownText = a;
  }
  const layersByPage = {};
  const comments = [];
  for (const a of records) {
    if (a.annotation_type === 'STYLUS' && a.strokes === null) continue;
    if (a.annotation_type === 'STYLUS' && a !== ownPages[a.page_number]) {
      (layersByPage[a.page_number] ??= []).push({ id: a.id, authorEmail: a.author_email, strokes: a.strokes });
    } else if (a.annotation_type === 'TEXT' && !a.problem_id && a !== ownText) {
      comments.push({ id: a.id, authorEmail: a.author_email, text: a.payload });
    }
  }
  return {
    layersByPage, comments,
    strokesByPage: Object.fromEntries(Object.entries(ownPages).map(([p, a]) => [p, a.strokes])),
    ids: { stylus: Object.fromEntries(Object.entries(ownPages).map(([p, a]) => [p, a.id])), text: ownText?.id ?? null },
    comment: ownText?.payload ?? '',
  };
}
