/* Conversion between the editor's box and the API's zone geometry.
 *
 * Editor: fractions 0-1 of the page, origin at the top-left corner (like the
 * annotation coordinates in the rest of the frontend).
 * API (apps.exams RecognitionZone): PDF points, origin at the bottom-left
 * corner, sized by the page profile's page_width/page_height.
 * Values are rounded to 0.01 pt so a round trip is stable. */

const r2 = (v) => Math.round(v * 100) / 100;

export function toPdfBox({ x, y, width, height }, { page_width: W, page_height: H }) {
  return {
    x: r2(x * W),
    y: r2((1 - y - height) * H),
    width: r2(width * W),
    height: r2(height * H),
  };
}

export function fromPdfBox({ x, y, width, height }, { page_width: W, page_height: H }) {
  if (!W || !H) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: x / W,
    y: 1 - (y + height) / H,
    width: width / W,
    height: height / H,
  };
}
