import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Flow tests lazy-load route chunks; under load (parallel agents, dev server)
// the default 1s wait is flaky. Observed in iteration 2 (see docs/tfg/04-iterations.md).
configure({ asyncUtilTimeout: 8000 });
