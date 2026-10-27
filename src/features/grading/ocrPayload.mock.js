import { mockError } from '../../lib/mock/router.js';

/** Mock input validation only. Stroke count simulates a reading, never OCR accuracy. */
export function validatedInk(content) {
  const invalid = () => { throw mockError(400, 'INVALID_STYLUS_PAYLOAD'); };
  if (new TextEncoder().encode(content).length > 4 * 1024 * 1024) invalid();
  let data;
  try { data = JSON.parse(content); } catch { invalid(); }
  const pad = Array.isArray(data);
  if (!pad && (!data || typeof data !== 'object' || (data.v !== undefined && data.v !== 1))) invalid();
  const strokes = pad ? data : data.strokes;
  if (!Array.isArray(strokes) || strokes.length > 10000) invalid();
  const number = (n) => typeof n === 'number' && Number.isFinite(n);
  let count = 0;
  for (const stroke of strokes) {
    const points = pad ? stroke : stroke?.points;
    if (!Array.isArray(points)) invalid();
    count += points.length;
    if (count > 100000) invalid();
    if (!pad && (stroke.tool !== undefined && !['pen', 'eraser'].includes(stroke.tool))) invalid();
    if (!pad && stroke.width !== undefined && (!number(stroke.width) || stroke.width <= 0 || stroke.width > 1)) invalid();
    for (const p of points) {
      if (!p || !number(p.x) || !number(p.y) || p.x < 0 || p.y < 0 || p.x > (pad ? 100 : 1) || p.y > (pad ? 100 : 1)) invalid();
    }
  }
  const ink = strokes.filter((s) => (pad ? s : s.points).length && (pad || s.tool !== 'eraser'));
  if (!ink.length) throw mockError(400, 'EMPTY_STYLUS_PAYLOAD');
  return ink;
}
