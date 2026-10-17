import { mockError } from '../../lib/mock/router.js';

// Mock transport helper: the UI forwards the original file, without parsing or renaming fields.
function readText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function csvRows(text) {
  const records = [];
  let cells = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      cells.push(cell); cell = ''; closed = false;
      if (char !== ',') {
        if (cells.some((value) => value.trim())) records.push(cells);
        cells = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('Invalid CSV');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV field');
  cells.push(cell);
  if (cells.some((value) => value.trim())) records.push(cells);
  const headers = records.shift()?.map((value) => value.trim());
  if (!headers?.length || headers.some((key) => !key) || new Set(headers).size !== headers.length) throw new Error('Invalid CSV header');
  return records.map((row) => row.length !== headers.length ? null : Object.fromEntries(headers.map((key, index) => [key, row[index]])));
}

export async function readImportFile(form) {
  const file = form?.get('file');
  if (!file || typeof file.name !== 'string') throw mockError(400, 'VALIDATION_ERROR', { file: ['FIELD_REQUIRED'] });
  try {
    const text = (await readText(file)).replace(/^\uFEFF/, '');
    const rows = /\.json$/i.test(file.name) ? JSON.parse(text) : /\.csv$/i.test(file.name) ? csvRows(text) : null;
    if (!Array.isArray(rows) || !rows.length) throw new Error('Invalid import');
    return rows;
  } catch {
    throw mockError(400, 'VALIDATION_ERROR', { file: ['INVALID'] });
  }
}

export function importRowError(index, error) {
  // errors[] is an opaque object array in OpenAPI; the UI never assumes these keys.
  const payload = error.__mock?.body;
  return { row: index + 1, error_code: payload?.error_code ?? 'VALIDATION_ERROR', ...(payload?.errors ? { errors: payload.errors } : {}) };
}
