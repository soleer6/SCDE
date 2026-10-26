import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configure } from '@testing-library/react';
import { afterAll, expect, vi } from 'vitest';
import { recordMutations } from './contract/mutations.js';

// pdf.js needs DOMMatrix, which jsdom lacks: PDF views render a stub in every test
// (files that need other behaviour override it with their own vi.mock).
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children }) => <div data-testid="pdf-doc">{children}</div>,
  Page: () => <div data-testid="pdf-page" />,
}));

// Flow tests lazy-load route chunks; under load (parallel agents, dev server)
// the default 1s wait is flaky. Observed in iteration 2 (see docs/tfg/04-iterations.md).
configure({ asyncUtilTimeout: 8000 });

// Every mutation a flow test sends through the mock is checked against the
// OpenAPI snapshot (see src/test/contract/mutations.js).
const recorder = recordMutations();
afterAll(async () => {
  expect(await recorder.stop(), 'mock mutation answers outside the backend contract').toEqual([]);
});

// Mock handlers fetch the seed PDFs from /public by relative URL, which jsdom
// cannot resolve: without this every download answered 500 and views fell
// back to their error state unnoticed. Tests may still replace fetch.
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (url, init) => {
  if (typeof url === 'string' && url.startsWith('/mock-pdfs/')) {
    const bytes = readFileSync(resolve('public', `.${url}`));
    return { ok: true, status: 200, blob: async () => new Blob([bytes], { type: 'application/pdf' }) };
  }
  return realFetch(url, init);
});
