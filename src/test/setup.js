import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { afterAll, expect } from 'vitest';
import { recordMutations } from './contract/mutations.js';

// Flow tests lazy-load route chunks; under load (parallel agents, dev server)
// the default 1s wait is flaky. Observed in iteration 2 (see docs/tfg/04-iterations.md).
configure({ asyncUtilTimeout: 8000 });

// Every mutation a flow test sends through the mock is checked against the
// OpenAPI snapshot (see src/test/contract/mutations.js).
const recorder = recordMutations();
afterAll(async () => {
  expect(await recorder.stop(), 'mock mutation answers outside the backend contract').toEqual([]);
});
